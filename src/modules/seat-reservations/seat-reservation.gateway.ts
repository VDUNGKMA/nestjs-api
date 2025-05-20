import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SeatReservationService } from './seat-reservations.service';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, restrict this to trusted domains
  },
  namespace: 'seats',
})
export class SeatReservationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(SeatReservationGateway.name);

  // Track clients by screening ID
  private clientsByScreening: Map<number, Set<string>> = new Map();

  constructor(private seatReservationService: SeatReservationService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove client from all screenings
    this.clientsByScreening.forEach((clients, screeningId) => {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        if (clients.size === 0) {
          this.clientsByScreening.delete(screeningId);
        }
      }
    });
  }

  @SubscribeMessage('join_screening')
  handleJoinScreening(client: Socket, screeningId: number) {
    this.logger.log(`Client ${client.id} joining screening ${screeningId}`);

    // Add client to screening room
    if (!this.clientsByScreening.has(screeningId)) {
      this.clientsByScreening.set(screeningId, new Set());
    }

    // Add the null check here
    const screeningClients = this.clientsByScreening.get(screeningId);
    if (screeningClients) {
      screeningClients.add(client.id);
    }

    // Join the Socket.IO room
    client.join(`screening:${screeningId}`);

    // Send initial seat status
    this.sendSeatStatus(screeningId);
  }

  @SubscribeMessage('leave_screening')
  handleLeaveScreening(client: Socket, screeningId: number) {
    this.logger.log(`Client ${client.id} leaving screening ${screeningId}`);

    // Remove client from screening tracking
    const clients = this.clientsByScreening.get(screeningId);
    if (clients) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.clientsByScreening.delete(screeningId);
      }
    }

    // Leave the Socket.IO room
    client.leave(`screening:${screeningId}`);
  }

  /**
   * Broadcast seat status updates to all clients viewing a specific screening
   */
  async sendSeatStatus(screeningId: number) {
    try {
      const availableSeats =
        await this.seatReservationService.getAvailableSeats(screeningId);

      this.server.to(`screening:${screeningId}`).emit('seat_status_update', {
        screening_id: screeningId,
        available_seats: availableSeats.map((seat) => ({
          id: seat.id,
          row: seat.seat_row,
          number: seat.seat_number,
          type: seat.seat_type,
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error sending seat status: ${error.message}`);
    }
  }

  /**
   * Notify clients when a seat is temporarily reserved
   */
  notifySeatReserved(screeningId: number, seatIds: number[], userId: number) {
    this.server.to(`screening:${screeningId}`).emit('seat_reserved', {
      screening_id: screeningId,
      seat_ids: seatIds,
      reserved_by: userId,
      timestamp: new Date().toISOString(),
    });

    // Update the full seat status after a short delay
    setTimeout(() => {
      this.sendSeatStatus(screeningId);
    }, 100);
  }

  /**
   * Notify clients when a seat reservation is cancelled or expired
   */
  notifySeatReleased(screeningId: number, seatIds: number[]) {
    this.server.to(`screening:${screeningId}`).emit('seat_released', {
      screening_id: screeningId,
      seat_ids: seatIds,
      timestamp: new Date().toISOString(),
    });

    // Update the full seat status after a short delay
    setTimeout(() => {
      this.sendSeatStatus(screeningId);
    }, 100);
  }

  /**
   * Notify clients about the current queue position and estimated wait time
   */
  notifyQueueStatus(
    screeningId: number,
    userId: number,
    position: number,
    estimatedWait: number,
  ) {
    this.server.to(`user:${userId}`).emit('queue_update', {
      screening_id: screeningId,
      position,
      estimated_wait_seconds: estimatedWait,
      timestamp: new Date().toISOString(),
    });
  }
}

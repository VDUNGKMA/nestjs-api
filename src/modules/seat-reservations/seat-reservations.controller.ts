import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  SeatReservationService,
  ReservationResult,
} from './seat-reservations.service';
import { CreateSeatReservationDto } from './dto/create-seat-reservation.dto';
import { SeatSuggestionService } from './seat-suggestion.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import {
  ReleaseSeatsJob,
  ReserveSeatJob,
  UpdateReservationTypeJob,
} from './seat-reservation.processor';
import { Public } from '../../decorators/public-route.decorator';
import { UpdateReservationTypeDto } from './dto/update-reservation-type.dto';
import { SuggestAlternativeSeatsDto } from './dto/suggest-alternative-seats.dto';

@Controller('seat-reservations')
export class SeatReservationController {
  constructor(
    private readonly seatReservationService: SeatReservationService,
    private readonly seatSuggestionService: SeatSuggestionService,
    @InjectQueue('seat-reservations') private reservationsQueue: Queue,
  ) {}

  @Post()
  @Public()
  async createReservation(@Body() createDto: CreateSeatReservationDto) {
    if (!createDto.request_timestamp) {
      createDto.request_timestamp = Date.now();
    }
    return this.seatReservationService.createReservations(createDto);
  }

  @Get('user/:userId/screening/:screeningId')
  @Public()
  async getUserReservations(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('screeningId', ParseIntPipe) screeningId: number,
  ) {
    return this.seatReservationService.getUserReservations(userId, screeningId);
  }

  @Delete('user/:userId/screening/:screeningId')
  @Public()
  async removeUserReservations(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('screeningId', ParseIntPipe) screeningId: number,
  ) {
    await this.seatReservationService.removeUserReservations(
      userId,
      screeningId,
    );
    return { success: true };
  }

  @Post('update-type')
  @Public()
  async updateReservationType(@Body() updateDto: UpdateReservationTypeDto) {
    const { user_id, screening_id, seat_ids, reservation_type } = updateDto;
    await this.seatReservationService.updateReservationType(
      user_id,
      screening_id,
      seat_ids,
      reservation_type,
    );
    return { success: true };
  }

  @Get('available')
  @Public()
  async checkSeatAvailability(
    @Query('screeningId', ParseIntPipe) screeningId: number,
    @Query('seatId', ParseIntPipe) seatId: number,
  ) {
    return this.seatReservationService.isSeatAvailable(screeningId, seatId);
  }

  @Get('available-seats/:screeningId')
  @Public()
  async getAvailableSeats(
    @Param('screeningId', ParseIntPipe) screeningId: number,
  ) {
    return this.seatReservationService.getAvailableSeats(screeningId);
  }

  @Post('suggest-alternatives')
  @HttpCode(HttpStatus.OK)
  @Public()
  async suggestAlternativeSeats(@Body() data: SuggestAlternativeSeatsDto) {
    return this.seatSuggestionService.suggestAlternativeSeats(
      data.screeningId,
      data.seatIds,
      data.count,
      data.preferPairs ?? true,
    );
  }

  @Post('cleanup')
  @Public()
  async cleanupExpiredReservations() {
    return this.seatReservationService.cleanupExpiredReservations();
  }

  @Get('queue-stats/:screeningId')
  @Public()
  async getQueueStats(@Param('screeningId', ParseIntPipe) screeningId: number) {
    try {
      const queue = await this.reservationsQueue.getJobCounts();
      return {
        waiting: queue.waiting,
        active: queue.active,
        delayed: queue.delayed,
        failed: queue.failed,
      };
    } catch (error) {
      return {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        error: error.message,
      };
    }
  }

  @Delete(':reservationId')
  async cancelReservation(@Param('reservationId') reservationId: string) {
    return this.seatReservationService.cancelReservation(reservationId);
  }
}

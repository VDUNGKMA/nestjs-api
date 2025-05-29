import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsersService } from './users.service';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtService } from '@nestjs/jwt';
import { FcmService } from './fcm.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private fcmService: FcmService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(
      'Socket connected: ' +
        client.id +
        ', userId: ' +
        client.handshake.query.token,
    );
    const token = client.handshake.query.token as string;
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      client.data.userId = payload.userId;
      client.join(`user:${payload.userId}`);
      this.logger.log(
        `User ${payload.userId} connected and joined room user:${payload.userId}`,
      );
      // Gửi trạng thái online cho bạn bè
      const friends = await this.usersService.getFriends(payload.userId);
      friends.forEach((friend) => {
        this.server
          .to(`user:${friend.id}`)
          .emit('friend_online', { userId: payload.userId });
      });
    } catch (e) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      // Gửi trạng thái offline cho bạn bè
      const friends = await this.usersService.getFriends(userId);
      friends.forEach((friend) => {
        this.server.to(`user:${friend.id}`).emit('friend_offline', { userId });
      });
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody() data: { userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`user:${data.userId}`);
    this.logger.log(`User ${data.userId} joined room user:${data.userId}`);
  }

  @SubscribeMessage('private_message')
  async handlePrivateMessage(
    @MessageBody()
    data: { senderId: number; receiverId: number; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const areFriends = await this.usersService.areFriends(
      data.senderId,
      data.receiverId,
    );
    if (!areFriends) {
      client.emit('error', { message: 'You can only message your friends' });
      return;
    }
    const message = await this.usersService.sendMessage(
      data.senderId,
      data.receiverId,
      data.content,
    );
    this.server.to(`user:${data.receiverId}`).emit('private_message', message);
    this.server.to(`user:${data.senderId}`).emit('private_message', message);
    // Gửi thông báo realtime cho người nhận
    if (data.senderId !== data.receiverId) {
      this.server
        .to(`user:${data.receiverId}`)
        .emit('new_message_notification', {
          from: data.senderId,
          message,
          timestamp: new Date().toISOString(),
        });
      // Kiểm tra user nhận có online không
      let receiverSockets: Set<any> | undefined;
      if (
        this.server.of &&
        this.server.of('/').adapter &&
        this.server.of('/').adapter.rooms
      ) {
        const sockets = this.server
          .of('/')
          .adapter.rooms.get(`user:${data.receiverId}`);
        receiverSockets = sockets instanceof Set ? sockets : undefined;
      } else if (
        this.server.sockets &&
        this.server.sockets.adapter &&
        this.server.sockets.adapter.rooms
      ) {
        const sockets =
          this.server.sockets.adapter.rooms[`user:${data.receiverId}`];
        receiverSockets = sockets instanceof Set ? sockets : undefined;
      }
      if (!receiverSockets || receiverSockets.size === 0) {
        // Nếu offline, gửi push notification qua FCM
        const receiver = await this.usersService.getUserById(data.receiverId);
        if (receiver && receiver.fcm_token) {
          await this.fcmService.sendNotification(
            receiver.fcm_token,
            'Tin nhắn mới',
            message.content,
            { senderId: data.senderId },
          );
        }
      }
    }
  }

  @SubscribeMessage('message_history')
  async handleMessageHistory(
    @MessageBody() data: { userId: number; friendId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const areFriends = await this.usersService.areFriends(
      data.userId,
      data.friendId,
    );
    if (!areFriends) {
      client.emit('error', {
        message: 'You can only view chat with your friends',
      });
      return;
    }
    const history = await this.usersService.getChatHistory(
      data.userId,
      data.friendId,
    );
    client.emit('message_history', history);
  }

  // Gửi thông báo realtime khi có lời mời kết bạn mới
  async notifyFriendRequest(receiverId: number, sender: any) {
    this.logger.log(
      `[notifyFriendRequest] server: ${!!this.server}, receiverId: ${receiverId}`,
    );
    if (!this.server) return;
    try {
      const rooms =
        this.server.of &&
        this.server.of('/').adapter &&
        this.server.of('/').adapter.rooms
          ? this.server.of('/').adapter.rooms
          : this.server.sockets &&
              this.server.sockets.adapter &&
              this.server.sockets.adapter.rooms
            ? this.server.sockets.adapter.rooms
            : null;
      if (rooms) {
        this.logger.log(`[notifyFriendRequest] rooms:`, rooms);
      } else {
        this.logger.log(`[notifyFriendRequest] rooms: không có adapter/rooms`);
      }
    } catch (e) {
      this.logger.warn(`[notifyFriendRequest] Không thể log rooms:`, e);
    }
    try {
      let receiverSockets: Set<any> | undefined;
      if (
        this.server.of &&
        this.server.of('/').adapter &&
        this.server.of('/').adapter.rooms
      ) {
        const sockets = this.server
          .of('/')
          .adapter.rooms.get(`user:${receiverId}`);
        receiverSockets = sockets instanceof Set ? sockets : undefined;
      } else if (
        this.server.sockets &&
        this.server.sockets.adapter &&
        this.server.sockets.adapter.rooms
      ) {
        const sockets = this.server.sockets.adapter.rooms[`user:${receiverId}`];
        receiverSockets = sockets instanceof Set ? sockets : undefined;
      }
      if (!receiverSockets || receiverSockets.size === 0) {
        // Nếu offline, gửi push notification qua FCM
        const receiver = await this.usersService.getUserById(receiverId);
        if (receiver && receiver.fcm_token) {
          await this.fcmService.sendNotification(
            receiver.fcm_token,
            'Lời mời kết bạn mới',
            `${sender.name} đã gửi cho bạn một lời mời kết bạn!`,
            { from: sender.id },
          );
        }
      }
    } catch (e) {
      this.logger.warn(
        `[notifyFriendRequest] Không thể kiểm tra receiverSockets:`,
        e,
      );
    }
    this.server.to(`user:${receiverId}`).emit('friend_request', {
      from: sender,
      timestamp: new Date().toISOString(),
    });
  }

  // Gửi thông báo realtime khi lời mời được chấp nhận
  async notifyFriendAccepted(senderId: number, receiver: any) {
    if (!this.server) return;
    try {
      let senderSockets: Set<any> | undefined;
      if (
        this.server.of &&
        this.server.of('/').adapter &&
        this.server.of('/').adapter.rooms
      ) {
        const sockets = this.server
          .of('/')
          .adapter.rooms.get(`user:${senderId}`);
        senderSockets = sockets instanceof Set ? sockets : undefined;
      } else if (
        this.server.sockets &&
        this.server.sockets.adapter &&
        this.server.sockets.adapter.rooms
      ) {
        const sockets = this.server.sockets.adapter.rooms[`user:${senderId}`];
        senderSockets = sockets instanceof Set ? sockets : undefined;
      }
      if (!senderSockets || senderSockets.size === 0) {
        const sender = await this.usersService.getUserById(senderId);
        if (sender && sender.fcm_token) {
          await this.fcmService.sendNotification(
            sender.fcm_token,
            'Lời mời kết bạn đã được chấp nhận',
            `${receiver.name} đã chấp nhận lời mời kết bạn của bạn!`,
            { by: receiver.id },
          );
        }
      }
    } catch (e) {
      this.logger.warn(
        `[notifyFriendAccepted] Không thể kiểm tra senderSockets:`,
        e,
      );
    }
    this.server.to(`user:${senderId}`).emit('friend_accepted', {
      by: receiver,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { senderId: number; receiverId: number },
    @ConnectedSocket() client: Socket,
  ) {
    // Gửi event typing tới bạn bè
    this.server
      .to(`user:${data.receiverId}`)
      .emit('typing', { from: data.senderId });
  }

  @SubscribeMessage('stop_typing')
  async handleStopTyping(
    @MessageBody() data: { senderId: number; receiverId: number },
    @ConnectedSocket() client: Socket,
  ) {
    this.server
      .to(`user:${data.receiverId}`)
      .emit('stop_typing', { from: data.senderId });
  }

  @SubscribeMessage('image_message')
  async handleImageMessage(
    @MessageBody()
    data: {
      senderId: number;
      receiverId: number;
      imageUrl: string;
      content?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const areFriends = await this.usersService.areFriends(
      data.senderId,
      data.receiverId,
    );
    if (!areFriends) {
      client.emit('error', { message: 'You can only message your friends' });
      return;
    }
    // Lưu tin nhắn ảnh vào DB (cần mở rộng model Message nếu chưa có trường imageUrl)
    const message = await this.usersService.sendImageMessage(
      data.senderId,
      data.receiverId,
      data.imageUrl,
      data.content || '',
    );
    this.server.to(`user:${data.receiverId}`).emit('image_message', message);
    this.server.to(`user:${data.senderId}`).emit('image_message', message);
  }

  @SubscribeMessage('signaling')
  async handleSignaling(
    @MessageBody() data: { senderId: number; receiverId: number; signal: any },
    @ConnectedSocket() client: Socket,
  ) {
    // Chuyển tiếp signaling data tới peer
    this.server.to(`user:${data.receiverId}`).emit('signaling', {
      from: data.senderId,
      signal: data.signal,
    });
  }

  @SubscribeMessage('file_message')
  async handleFileMessage(
    @MessageBody()
    data: {
      senderId: number;
      receiverId: number;
      fileUrl: string;
      fileName: string;
      content?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const areFriends = await this.usersService.areFriends(
      data.senderId,
      data.receiverId,
    );
    if (!areFriends) {
      client.emit('error', { message: 'You can only message your friends' });
      return;
    }
    const message = await this.usersService.sendFileMessage(
      data.senderId,
      data.receiverId,
      data.fileUrl,
      data.fileName,
      data.content || '',
    );
    this.server.to(`user:${data.receiverId}`).emit('file_message', message);
    this.server.to(`user:${data.senderId}`).emit('file_message', message);
  }
}

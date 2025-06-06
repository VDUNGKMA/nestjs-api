import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { User } from '../../models/user.model';
import { Friendship } from '../../models/friendship.model';
import { Message } from '../../models/message.model';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import { ChatGateway } from './chat.gateway';
import { FcmService } from './fcm.service';

@Module({
  imports: [SequelizeModule.forFeature([User, Friendship, Message])],
  controllers: [UsersController, AdminController],
  providers: [UsersService, JwtAuthGuard, ChatGateway, FcmService],
  exports: [UsersService, ChatGateway, FcmService], // Xuất ra để AuthModule có thể sử dụng
})
export class UsersModule {}

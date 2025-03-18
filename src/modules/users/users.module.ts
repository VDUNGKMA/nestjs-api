import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { User } from '../../models/user.model';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';


@Module({
  imports: [SequelizeModule.forFeature([User])],
  controllers: [UsersController, AdminController],
  providers: [UsersService, JwtAuthGuard ] ,
  exports: [UsersService], // Xuất ra để AuthModule có thể sử dụng
})
export class UsersModule {}

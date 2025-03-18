import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TheaterRoom } from '../../models/theater-room.model';
import { TheaterRoomService } from './theater_room.service';
import { TheaterRoomController } from './theater_room.controller';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import { Theater } from 'src/models/theater.model';

@Module({
  imports: [
    SequelizeModule.forFeature([TheaterRoom]),
    SequelizeModule.forFeature([Theater]),
  ],
  controllers: [TheaterRoomController],
  providers: [TheaterRoomService, JwtAuthGuard],
  exports: [TheaterRoomService],
})
export class TheaterRoomModule {}

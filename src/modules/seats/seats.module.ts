// src/seats/seat.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Seat } from '../../models/seat.model';
import { SeatService } from './seats.service';
import { SeatController } from './seats.controller';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import { TheaterRoom } from 'src/models/theater-room.model';

@Module({
  imports: [
    SequelizeModule.forFeature([Seat]),
    SequelizeModule.forFeature([TheaterRoom]),
  ],
  controllers: [SeatController],
  providers: [SeatService, JwtAuthGuard],
})
export class SeatModule {}

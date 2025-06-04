// src/screenings/screening.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Screening } from '../../models/screening.model';
import { ScreeningService } from './screenings.service';
import { ScreeningController } from './screenings.controller';
import { Movie } from '../../models/movie.model';
import { TheaterRoom } from '../../models/theater-room.model';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';

@Module({
  imports: [SequelizeModule.forFeature([Screening, Movie, TheaterRoom])],
  controllers: [ScreeningController],
  providers: [ScreeningService, JwtAuthGuard],
})
export class ScreeningModule {}

import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from '../../models/user.model';
import { Movie } from '../../models/movie.model';
import { Ticket } from '../../models/ticket.model';
import { Screening } from '../../models/screening.model';
import { Genre } from '../../models/genre.model';

@Module({
  imports: [
    SequelizeModule.forFeature([User, Movie, Ticket, Screening, Genre]),
  ],
  controllers: [ExportController],
})
export class ExportModule {}

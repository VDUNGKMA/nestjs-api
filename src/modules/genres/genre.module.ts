import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Genre } from '../../models/genre.model';
import { MovieGenre } from '../../models/movie-genre.model';
import { GenreService } from './genre.service';
import { GenreController } from './genre.controller';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';

@Module({
  imports: [SequelizeModule.forFeature([Genre, MovieGenre])],
  controllers: [GenreController],
  providers: [GenreService, JwtAuthGuard],
  exports: [GenreService],
})
export class GenreModule {}

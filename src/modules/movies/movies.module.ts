import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Movie } from '../../models/movie.model';
import { MovieRating } from '../../models/movie-rating.model';

@Module({
  imports: [SequelizeModule.forFeature([Movie, MovieRating])],
})
export class MoviesModule {}

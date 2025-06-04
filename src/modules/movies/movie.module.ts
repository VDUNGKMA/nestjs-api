import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Movie } from 'src/models/movie.model';
import { MovieGenre } from '../../models/movie-genre.model';
import { MoviesService } from './movie.service';
import { MovieController } from './movie.controller';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import { Genre } from 'src/models/genre.model';
import { Screening } from 'src/models/screening.model';
import { MovieRating } from '../../models/movie-rating.model';
import { MovieComment } from '../../models/movie-comment.model';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
@Module({
  imports: [
    SequelizeModule.forFeature([
      Movie,
      MovieGenre,
      Genre,
      Screening,
      MovieRating,
      MovieComment,
    ]),
    RecommendationModule,
    ElasticsearchModule,
  ],
  controllers: [MovieController],
  providers: [MoviesService, JwtAuthGuard],
  exports: [MoviesService],
})
export class MovieModule {}

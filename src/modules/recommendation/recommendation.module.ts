import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';

// Controllers
import { RecommendationController } from './controllers/recommendation.controller';

// Services
import { RecommendationService } from './services/recommendation.service';
import { ContentBasedService } from './services/content-based.service';
import { CollaborativeFilteringService } from './services/collaborative-filtering.service';
import { ContextAwareService } from './services/context-aware.service';
import { DataCollectionService } from './services/data-collection.service';
import { ModelTrainingService } from './services/model-training.service';
import { ScreeningRecommendationService } from './services/screening-recommendation.service';
import { UsersService } from '../users/users.service';

// Models
import { BookingRecommendation } from '../../models/booking-recommendation.entity';
import { UserPreference } from '../../models/user-preference.model';
import { MovieSimilarity } from '../../models/movie-similarity.model';
import { MovieRating } from '../../models/movie-rating.model';
import { Movie } from '../../models/movie.model';
import { User } from '../../models/user.model';
import { Ticket } from '../../models/ticket.model';
import { Screening } from '../../models/screening.model';
import { Theater } from '../../models/theater.model';
import { Genre } from '../../models/genre.model';

// Processors
import { RecommendationProcessor } from './processors/recommendation.processor';
import { TheaterRoom } from 'src/models/theater-room.model';
import { Message } from 'src/models/message.model';
import { UsersModule } from '../users/users.module';
import { ChatGateway } from '../users/chat.gateway';

@Module({
  imports: [
    UsersModule,
    SequelizeModule.forFeature([
      BookingRecommendation,
      UserPreference,
      MovieSimilarity,
      MovieRating,
      Movie,
      User,
      Ticket,
      Screening,
      Theater,
      Genre,
      TheaterRoom,
      Message,
    ]),
    BullModule.registerQueue({
      name: 'recommendation',
    }),
    HttpModule,
  ],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    ContentBasedService,
    CollaborativeFilteringService,
    ContextAwareService,
    DataCollectionService,
    ModelTrainingService,
    RecommendationProcessor,
    ScreeningRecommendationService,
    UsersService,
  ],
  exports: [
    RecommendationService,
    DataCollectionService,
    ScreeningRecommendationService,
  ],
})
export class RecommendationModule {}

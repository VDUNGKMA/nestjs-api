import { Module, forwardRef } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { MovieModule } from '../movies/movie.module';
import { TicketModule } from '../tickets/tickets.module';

@Module({
  imports: [forwardRef(() => MovieModule), forwardRef(() => TicketModule)],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule {}

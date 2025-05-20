import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SeatReservation } from '../../models/seat-reservation.model';
import { SeatReservationService } from './seat-reservations.service';
import { SeatReservationController } from './seat-reservations.controller';
import { User } from '../../models/user.model';
import { Screening } from '../../models/screening.model';
import { Seat } from '../../models/seat.model';
import { Ticket } from '../../models/ticket.model';
import { SeatReservationsCleanupService } from './seat-reservations-cleanup.service';
import { SeatSuggestionService } from './seat-suggestion.service';
import { TheaterRoom } from '../../models/theater-room.model';
import { BullModule } from '@nestjs/bull';
import { SeatReservationProcessor } from './seat-reservation.processor';
import { SeatReservationGateway } from './seat-reservation.gateway';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisLockService } from './redis-lock.service';
import type { RedisClientOptions } from 'redis';

@Module({
  imports: [
    SequelizeModule.forFeature([
      SeatReservation,
      User,
      Screening,
      Seat,
      Ticket,
      TheaterRoom,
    ]),
    BullModule.registerQueue({
      name: 'seat-reservations',
    }),
    CacheModule.registerAsync<RedisClientOptions>({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        socket: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
        },
        ttl: 60 * 10, // 10 minutes
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SeatReservationController],
  providers: [
    SeatReservationService,
    SeatReservationsCleanupService,
    SeatSuggestionService,
    SeatReservationProcessor,
    SeatReservationGateway,
    RedisLockService,
  ],
  exports: [SeatReservationService, SeatSuggestionService],
})
export class SeatReservationsModule {}

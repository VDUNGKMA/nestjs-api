import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers
import { AppController } from './app.controller';

// Services
import { AppService } from './app.service';

// Modules
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { MovieModule } from './modules/movies/movie.module';
import { GenreModule } from './modules/genres/genre.module';
import { TheaterModule } from './modules/theaters/theaters.module';
import { ScreeningModule } from './modules/screenings/screenings.module';
import { SeatModule } from './modules/seats/seats.module';
import { TicketModule } from './modules/tickets/tickets.module';
import { FoodDrinksModule } from './modules/food-drinks/food-drinks.module';
import { PaymentModule } from './modules/payments/payment.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { SeatReservationsModule } from './modules/seat-reservations/seat-reservations.module';
import { TheaterRoomModule } from './modules/theater_room/theater_room.module';
import { TicketSeatsModule } from './modules/ticket-seats/ticket-seats.module';
import { ExportModule } from './modules/export/export.module';
import { QRCodeModule } from './modules/qr-codes/qr-codes.module';
import { UploadModule } from './modules/upload/upload.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/passport/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        dialect: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_NAME', 'movie_booking'),
        autoLoadModels: true,
        synchronize: false,
        define: {
          underscored: true, // Tất cả các model sẽ sử dụng snake_case cho các cột timestamp
        },
      }),

      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    UsersModule,
    AuthModule,
    MovieModule,
    GenreModule,
    TheaterModule,
    ScreeningModule,
    SeatModule,
    TicketModule,
    FoodDrinksModule,
    PaymentModule,
    RecommendationModule,
    SeatReservationsModule,
    TheaterRoomModule,
    TicketSeatsModule,
    ExportModule,
    QRCodeModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

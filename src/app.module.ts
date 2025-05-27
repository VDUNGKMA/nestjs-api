import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { models } from './models';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/passport/jwt-auth.guard';
import { MovieModule } from './modules/movies/movie.module';
import { GenreModule } from './modules/genres/genre.module';
import { TheaterModule } from './modules/theaters/theaters.module';
import { TheaterRoomModule } from './modules/theater_room/theater_room.module';
import { SeatModule } from './modules/seats/seats.module';
import { ScreeningModule } from './modules/screenings/screenings.module';
import { TicketModule } from './modules/tickets/tickets.module';
import { PaymentModule } from './modules/payments/payment.module';
// import { QRCodeModule } from './modules/qr-codes/qr-codes.module'; // Tạm thời comment lại
import { SeatReservationsModule } from './modules/seat-reservations/seat-reservations.module';
import { FoodDrinksModule } from './modules/food-drinks/food-drinks.module';
import { UploadModule } from './modules/upload/upload.module';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { TicketSeatsModule } from './modules/ticket-seats/ticket-seats.module';
import { MovieRating } from './models/movie-rating.model';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
// import { WatchHistoryModule } from './modules/watch-history/watch-history.module';
import { ExportModule } from './modules/export/export.module';
import { QRCodeModule } from './modules/qr-codes/qr-codes.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Load .env
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      models: models, // Đăng ký toàn bộ models
      autoLoadModels: true,
      timezone: '+07:00', // Đặt múi giờ mặc định là UTC+7
      dialectOptions: {
        useUTC: false, // Tắt UTC để dùng giờ địa phương
        dateStrings: true, // Trả về thời gian dưới dạng chuỗi thay vì Date object
        // Optimize for maximum connections
        pool: {
          max: 25, // Maximum number of connections in pool
          min: 5, // Minimum number of connections in pool
          idle: 10000, // Maximum time (ms) that a connection can be idle before being released
          acquire: 60000, // Maximum time (ms) that pool will try to get connection before throwing error
          evict: 1000, // How often to check for idle connections to be removed
        },
      },
      synchronize: false,
      define: {
        underscored: true, // Tất cả các model sẽ sử dụng snake_case cho các cột timestamp
      },
      pool: {
        max: 25,
        min: 5,
        idle: 10000,
        acquire: 60000,
      },
    }),
    SequelizeModule.forFeature([MovieRating]),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        ttl: 600, // 10 minutes
        max: 1000, // Maximum number of items in cache
        isGlobal: true,
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: Number(configService.get('REDIS_PORT', 6379)),
          // Increase connection pool for high throughput
          maxRetriesPerRequest: 10,
          enableReadyCheck: false,
          connectTimeout: 10000,
        },
        // Global settings for all queues
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: true,
          removeOnFail: false,
          timeout: 30000, // 30 seconds timeout
        },
        limiter: {
          max: 1000, // Max number of jobs processed in duration
          duration: 1000, // Duration in ms for rate limiting
        },
      }),
    }),
    UsersModule,
    AuthModule,
    MovieModule,
    GenreModule,
    TheaterModule,
    TheaterRoomModule,
    SeatModule,
    ScreeningModule,
    TicketModule,
    PaymentModule,
    QRCodeModule,
    SeatReservationsModule,
    FoodDrinksModule,
    UploadModule,
    TicketSeatsModule,
    // WatchHistoryModule,
    RecommendationModule,
    ExportModule,
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

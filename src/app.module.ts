import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
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
        // typeCast: true, // Cho phép Sequelize tự xử lý kiểu dữ liệu
      },
      synchronize: false,
      define: {
        underscored: true, // Tất cả các model sẽ sử dụng snake_case cho các cột timestamp
      },
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

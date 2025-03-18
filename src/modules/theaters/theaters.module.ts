import { Module } from '@nestjs/common';
import { TheatersService } from './theaters.service';
import { TheatersController } from './theaters.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Theater } from 'src/models/theater.model';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import { TheaterRoom } from 'src/models/theater-room.model';

@Module({
  imports: [SequelizeModule.forFeature([Theater, TheaterRoom])],
  controllers: [TheatersController],
  providers: [TheatersService, JwtAuthGuard],
})
export class TheaterModule {}

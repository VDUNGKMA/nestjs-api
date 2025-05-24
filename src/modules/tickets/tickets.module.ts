import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Ticket } from '../../models/ticket.model';
import { TicketService } from './tickets.service';
import { TicketController } from './tickets.controller';
import { User } from '../../models/user.model';
import { Screening } from '../../models/screening.model';
import { Seat } from '../../models/seat.model';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import { SeatReservation } from '../../models/seat-reservation.model';
import { FoodDrink } from '../../models/food-drink.model';
import { TicketFoodDrink } from '../../models/ticket-food-drink.model';
import { TicketSeat } from '../../models/ticket-seat.model';
import { Movie } from '../../models/movie.model';
import { TheaterRoom } from '../../models/theater-room.model';
import { Theater } from '../../models/theater.model';
import { TicketCleanupService } from './ticket-cleanup.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Ticket,
      User,
      Screening,
      Seat,
      SeatReservation,
      FoodDrink,
      TicketFoodDrink,
      TicketSeat,
      Movie,
      TheaterRoom,
      Theater,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [TicketController],
  providers: [TicketService, JwtAuthGuard, TicketCleanupService],
  exports: [TicketService],
})
export class TicketModule {}

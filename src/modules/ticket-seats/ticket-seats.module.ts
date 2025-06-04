import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TicketSeatsController } from './ticket-seats.controller';
import { TicketSeatService } from './ticket-seats.service';
import { TicketSeat } from '../../models/ticket-seat.model';
import { Ticket } from '../../models/ticket.model';
import { Seat } from '../../models/seat.model';

@Module({
  imports: [SequelizeModule.forFeature([TicketSeat, Ticket, Seat])],
  controllers: [TicketSeatsController],
  providers: [TicketSeatService],
  exports: [TicketSeatService],
})
export class TicketSeatsModule {}

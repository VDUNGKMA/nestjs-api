
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Ticket } from '../../models/ticket.model';
import { TicketService } from './tickets.service';
import { TicketController } from './tickets.controller';
import { User } from '../../models/user.model';
import { Screening } from '../../models/screening.model';
import { Seat } from '../../models/seat.model';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';

@Module({
  imports: [SequelizeModule.forFeature([Ticket, User, Screening, Seat])],
  controllers: [TicketController],
  providers: [TicketService, JwtAuthGuard],
})
export class TicketModule {}

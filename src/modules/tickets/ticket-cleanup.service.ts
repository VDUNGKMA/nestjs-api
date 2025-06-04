import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Ticket } from '../../models/ticket.model';
import { TicketSeat } from '../../models/ticket-seat.model';
import { Op } from 'sequelize';

@Injectable()
export class TicketCleanupService {
  private readonly logger = new Logger(TicketCleanupService.name);

  constructor(
    @InjectModel(Ticket) private ticketModel: typeof Ticket,
    @InjectModel(TicketSeat) private ticketSeatModel: typeof TicketSeat,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredTickets() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Tìm các vé pending quá 10 phút
    const expiredTickets = await this.ticketModel.findAll({
      where: {
        status: 'booked',
        booking_time: { [Op.lt]: tenMinutesAgo },
      },
    });

    for (const ticket of expiredTickets) {
      // Xóa TicketSeats liên quan
      await this.ticketSeatModel.destroy({ where: { ticket_id: ticket.id } });
      // Xóa vé
      await ticket.destroy();
      this.logger.log(`Đã xóa vé hết hạn id=${ticket.id}`);
    }
  }
}

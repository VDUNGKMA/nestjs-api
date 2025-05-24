import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TicketSeat } from '../../models/ticket-seat.model';
import { Ticket } from '../../models/ticket.model';
import { Seat } from '../../models/seat.model';
import { Sequelize } from 'sequelize-typescript';
import { Transaction, Op } from 'sequelize';

@Injectable()
export class TicketSeatService {
  constructor(
    @InjectModel(TicketSeat) private ticketSeatModel: typeof TicketSeat,
    @InjectModel(Ticket) private ticketModel: typeof Ticket,
    @InjectModel(Seat) private seatModel: typeof Seat,
    private sequelize: Sequelize,
  ) {}

  // Tạo liên kết ghế cho vé
  async create(
    ticketId: number,
    seatId: number,
    price?: number,
  ): Promise<TicketSeat> {
    const transaction = await this.sequelize.transaction();

    try {
      // Kiểm tra vé tồn tại
      const ticket = await this.ticketModel.findByPk(ticketId, { transaction });
      if (!ticket) {
        throw new NotFoundException(`Không tìm thấy vé với id ${ticketId}`);
      }

      // Kiểm tra ghế tồn tại
      const seat = await this.seatModel.findByPk(seatId, { transaction });
      if (!seat) {
        throw new NotFoundException(`Không tìm thấy ghế với id ${seatId}`);
      }

      // Kiểm tra xem ghế đã được đặt cho vé nào khác không
      const existingTicketSeat = await this.ticketSeatModel.findOne({
        where: { seat_id: seatId, ticket_id: { [Op.ne]: ticketId } },
        include: [
          {
            model: Ticket,
            where: {
              screening_id: ticket.screening_id,
              status: { [Op.ne]: 'cancelled' },
            },
          },
        ],
        transaction,
      });

      if (existingTicketSeat) {
        throw new BadRequestException(
          `Ghế ${seatId} đã được đặt cho vé khác trong cùng suất chiếu`,
        );
      }

      // Tạo liên kết ghế với vé
      const ticketSeat = await this.ticketSeatModel.create(
        {
          ticket_id: ticketId,
          seat_id: seatId,
          price,
        },
        { transaction },
      );

      // Cập nhật tổng giá vé
      await this.updateTicketTotalPrice(ticketId, transaction);

      await transaction.commit();
      return ticketSeat;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Thêm nhiều ghế cho một vé
  async addMultipleSeatsToTicket(
    ticketId: number,
    seatIds: number[],
    prices?: number[],
  ): Promise<TicketSeat[]> {
    const transaction = await this.sequelize.transaction();

    try {
      // Kiểm tra vé tồn tại
      const ticket = await this.ticketModel.findByPk(ticketId, { transaction });
      if (!ticket) {
        throw new NotFoundException(`Không tìm thấy vé với id ${ticketId}`);
      }

      // Mảng kết quả
      const results: TicketSeat[] = [];

      // Thêm từng ghế
      for (let i = 0; i < seatIds.length; i++) {
        const seatId = seatIds[i];
        const price = prices && prices[i] ? prices[i] : undefined;

        // Kiểm tra ghế tồn tại
        const seat = await this.seatModel.findByPk(seatId, { transaction });
        if (!seat) {
          throw new NotFoundException(`Không tìm thấy ghế với id ${seatId}`);
        }

        // Kiểm tra xem ghế đã được đặt cho vé nào khác không
        const existingTicketSeat = await this.ticketSeatModel.findOne({
          where: { seat_id: seatId },
          include: [
            {
              model: Ticket,
              where: {
                screening_id: ticket.screening_id,
                status: { [Op.ne]: 'cancelled' },
                id: { [Op.ne]: ticketId },
              },
            },
          ],
          transaction,
        });

        if (existingTicketSeat) {
          throw new BadRequestException(
            `Ghế ${seatId} đã được đặt cho vé khác trong cùng suất chiếu`,
          );
        }

        // Kiểm tra xem ghế đã được thêm vào vé này chưa
        const existingForThisTicket = await this.ticketSeatModel.findOne({
          where: { seat_id: seatId, ticket_id: ticketId },
          transaction,
        });

        if (existingForThisTicket) {
          // Nếu đã tồn tại, cập nhật giá nếu cần
          if (price !== undefined) {
            await existingForThisTicket.update({ price }, { transaction });
          }
          results.push(existingForThisTicket);
        } else {
          // Nếu chưa tồn tại, tạo mới
          const ticketSeat = await this.ticketSeatModel.create(
            {
              ticket_id: ticketId,
              seat_id: seatId,
              price,
            },
            { transaction },
          );
          results.push(ticketSeat);
        }
      }

      // Cập nhật tổng giá vé
      await this.updateTicketTotalPrice(ticketId, transaction);

      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Cập nhật tổng giá của vé dựa trên giá của tất cả ghế
  private async updateTicketTotalPrice(
    ticketId: number,
    transaction?: Transaction,
  ): Promise<void> {
    // Lấy tất cả ghế của vé
    const ticketSeats = await this.ticketSeatModel.findAll({
      where: { ticket_id: ticketId },
      transaction,
    });

    // Tính tổng giá
    let totalPrice = 0;
    for (const seat of ticketSeats) {
      if (seat.price) {
        totalPrice += seat.price;
      }
    }

    // Lấy vé cần cập nhật
    const ticket = await this.ticketModel.findByPk(ticketId, { transaction });
    if (ticket) {
      // Cập nhật trực tiếp trên instance
      await ticket.update({ total_price: totalPrice }, { transaction });
    }
  }

  // Lấy tất cả ghế của một vé
  async findAllByTicketId(ticketId: number): Promise<TicketSeat[]> {
    return this.ticketSeatModel.findAll({
      where: { ticket_id: ticketId },
      include: [{ model: Seat }],
    });
  }

  // Xóa ghế khỏi vé
  async remove(ticketId: number, seatId: number): Promise<void> {
    const transaction = await this.sequelize.transaction();

    try {
      const ticketSeat = await this.ticketSeatModel.findOne({
        where: { ticket_id: ticketId, seat_id: seatId },
        transaction,
      });

      if (!ticketSeat) {
        throw new NotFoundException(
          `Không tìm thấy ghế ${seatId} cho vé ${ticketId}`,
        );
      }

      await ticketSeat.destroy({ transaction });

      // Cập nhật tổng giá vé
      await this.updateTicketTotalPrice(ticketId, transaction);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

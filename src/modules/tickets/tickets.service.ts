
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Ticket } from '../../models/ticket.model';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { User } from '../../models/user.model';
import { Screening } from '../../models/screening.model';
import { Seat } from '../../models/seat.model';

@Injectable()
export class TicketService {
  constructor(
    @InjectModel(Ticket) private ticketModel: typeof Ticket,
    @InjectModel(User) private userModel: typeof User,
    @InjectModel(Screening) private screeningModel: typeof Screening,
    @InjectModel(Seat) private seatModel: typeof Seat,
  ) {}

  // Tạo vé mới
  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
    const user = await this.userModel.findByPk(createTicketDto.user_id);
    if (!user) {
      throw new NotFoundException(
        `Không tìm thấy người dùng với id ${createTicketDto.user_id}`,
      );
    }

    const screening = await this.screeningModel.findByPk(
      createTicketDto.screening_id,
    );
    if (!screening) {
      throw new NotFoundException(
        `Không tìm thấy suất chiếu với id ${createTicketDto.screening_id}`,
      );
    }

    if (createTicketDto.seat_id) {
      const seat = await this.seatModel.findByPk(createTicketDto.seat_id);
      if (!seat) {
        throw new NotFoundException(
          `Không tìm thấy ghế với id ${createTicketDto.seat_id}`,
        );
      }
      // Kiểm tra xem ghế đã được đặt cho suất chiếu này chưa
      const existingTicket = await this.ticketModel.findOne({
        where: {
          screening_id: createTicketDto.screening_id,
          seat_id: createTicketDto.seat_id,
        },
      });
      if (existingTicket) {
        throw new BadRequestException(
          `Ghế với id ${createTicketDto.seat_id} đã được đặt cho suất chiếu ${createTicketDto.screening_id}`,
        );
      }
    }

    const ticketData = {
      ...createTicketDto,
      booking_time: new Date(),
     
    };

    return this.ticketModel.create(ticketData);
  }

  // Lấy tất cả vé
  async findAll(): Promise<Ticket[]> {
    return this.ticketModel.findAll({
      include: [{ model: User }, { model: Screening }],
    });
  }

  // Lấy một vé theo ID
  async findOne(id: number): Promise<Ticket> {
    const ticket = await this.ticketModel.findByPk(id);
    if (!ticket) {
      throw new NotFoundException(`Không tìm thấy vé với id ${id}`);
    }
    return ticket;
  }

  // Cập nhật vé
  async update(id: number, updateTicketDto: UpdateTicketDto): Promise<Ticket> {
    const ticket = await this.findOne(id);

    if (updateTicketDto.user_id) {
      const user = await this.userModel.findByPk(updateTicketDto.user_id);
      if (!user) {
        throw new NotFoundException(
          `Không tìm thấy người dùng với id ${updateTicketDto.user_id}`,
        );
      }
    }

    if (updateTicketDto.screening_id) {
      const screening = await this.screeningModel.findByPk(
        updateTicketDto.screening_id,
      );
      if (!screening) {
        throw new NotFoundException(
          `Không tìm thấy suất chiếu với id ${updateTicketDto.screening_id}`,
        );
      }
    }

    if (updateTicketDto.seat_id) {
      const seat = await this.seatModel.findByPk(updateTicketDto.seat_id);
      if (!seat) {
        throw new NotFoundException(
          `Không tìm thấy ghế với id ${updateTicketDto.seat_id}`,
        );
      }
    }

    await ticket.update(updateTicketDto);
    return ticket;
  }

  // Xóa vé
  async remove(id: number): Promise<void> {
    const ticket = await this.findOne(id);
    await ticket.destroy();
  }
}

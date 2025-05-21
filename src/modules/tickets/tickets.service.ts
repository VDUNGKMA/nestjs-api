import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Ticket } from '../../models/ticket.model';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { User } from '../../models/user.model';
import { Screening } from '../../models/screening.model';
import { Seat } from '../../models/seat.model';
import { SeatReservation } from '../../models/seat-reservation.model';
import { TicketFoodDrink } from '../../models/ticket-food-drink.model';
import { FoodDrink } from '../../models/food-drink.model';
import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { Movie } from 'src/models/movie.model';
import { TheaterRoom } from 'src/models/theater-room.model';
import { Theater } from 'src/models/theater.model';

@Injectable()
export class TicketService {
  constructor(
    @InjectModel(Ticket) private ticketModel: typeof Ticket,
    @InjectModel(User) private userModel: typeof User,
    @InjectModel(Screening) private screeningModel: typeof Screening,
    @InjectModel(Seat) private seatModel: typeof Seat,
    @InjectModel(SeatReservation)
    private seatReservationModel: typeof SeatReservation,
    @InjectModel(TicketFoodDrink)
    private ticketFoodDrinkModel: typeof TicketFoodDrink,
    @InjectModel(FoodDrink)
    private foodDrinkModel: typeof FoodDrink,
    private sequelize: Sequelize,
  ) {}

  // Tạo vé mới với xử lý transaction
  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
    // Bắt đầu transaction với isolation level cao
    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    try {
      const user = await this.userModel.findByPk(createTicketDto.user_id, {
        transaction,
      });
      if (!user) {
        throw new NotFoundException(
          `Không tìm thấy người dùng với id ${createTicketDto.user_id}`,
        );
      }

      const screening = await this.screeningModel.findByPk(
        createTicketDto.screening_id,
        { transaction },
      );
      if (!screening) {
        throw new NotFoundException(
          `Không tìm thấy suất chiếu với id ${createTicketDto.screening_id}`,
        );
      }

      if (createTicketDto.seat_id) {
        const seat = await this.seatModel.findByPk(createTicketDto.seat_id, {
          transaction,
        });
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
          transaction,
        });

        if (existingTicket) {
          throw new BadRequestException(
            `Ghế với id ${createTicketDto.seat_id} đã được đặt cho suất chiếu ${createTicketDto.screening_id}`,
          );
        }

        // Kiểm tra xem có đặt chỗ tạm thời nào đang hiệu lực không
        const reservation = await this.seatReservationModel.findOne({
          where: {
            screening_id: createTicketDto.screening_id,
            seat_id: createTicketDto.seat_id,
          },
          transaction,
        });

        // Nếu có đặt chỗ tạm thời và không phải của người dùng hiện tại
        if (
          reservation &&
          new Date(reservation.expires_at) > new Date() &&
          reservation.user_id !== createTicketDto.user_id
        ) {
          throw new BadRequestException(
            `Ghế với id ${createTicketDto.seat_id} đang được giữ tạm thời bởi người dùng khác`,
          );
        }

        // Nếu là đặt chỗ tạm thời của người dùng hiện tại, xóa nó đi
        if (reservation && reservation.user_id === createTicketDto.user_id) {
          await reservation.destroy({ transaction });
        }
      }

      const ticketData = {
        ...createTicketDto,
        booking_time: new Date(),
      };

      const ticket = await this.ticketModel.create(ticketData, { transaction });

      // Commit transaction nếu mọi thứ OK
      await transaction.commit();
      return ticket;
    } catch (error) {
      // Rollback transaction nếu có lỗi
      await transaction.rollback();
      throw error;
    }
  }

  // Lấy tất cả vé
  async findAll(): Promise<Ticket[]> {
    return this.ticketModel.findAll({
      include: [
        { model: User },
        { model: Screening },
        { model: Seat },
        {
          model: TicketFoodDrink,
          include: [{ model: FoodDrink }],
        },
      ],
    });
  }

  // Lấy một vé theo ID
  async findOne(id: number): Promise<Ticket> {
    const ticket = await this.ticketModel.findByPk(id, {
      include: [
        { model: User },
        { model: Screening },
        { model: Seat },
        {
          model: TicketFoodDrink,
          include: [{ model: FoodDrink }],
        },
      ],
    });
    if (!ticket) {
      throw new NotFoundException(`Không tìm thấy vé với id ${id}`);
    }
    return ticket;
  }

  // Lấy vé theo user_id
  async findByUserId(userId: number): Promise<Ticket[]> {
    return this.ticketModel.findAll({
      where: { user_id: userId },
      include: [
        { model: User },
        { model: Screening,
          include: [
            {
              model: Movie,
              attributes: ['title', 'poster_url'],
            },
            {
              model: TheaterRoom,
              include: [
                {
                  model: Theater,
                },
              ],
            },
          ],
        },
      
        { model: Seat },
        {
          model: TicketFoodDrink,
          include: [{ model: FoodDrink }],
        },
      ],
    });
  }

  // Cập nhật vé
  async update(id: number, updateTicketDto: UpdateTicketDto): Promise<Ticket> {
    const transaction = await this.sequelize.transaction();

    try {
      const ticket = await this.findOne(id);

      if (updateTicketDto.user_id) {
        const user = await this.userModel.findByPk(updateTicketDto.user_id, {
          transaction,
        });
        if (!user) {
          throw new NotFoundException(
            `Không tìm thấy người dùng với id ${updateTicketDto.user_id}`,
          );
        }
      }

      if (updateTicketDto.screening_id) {
        const screening = await this.screeningModel.findByPk(
          updateTicketDto.screening_id,
          { transaction },
        );
        if (!screening) {
          throw new NotFoundException(
            `Không tìm thấy suất chiếu với id ${updateTicketDto.screening_id}`,
          );
        }
      }

      if (updateTicketDto.seat_id) {
        const seat = await this.seatModel.findByPk(updateTicketDto.seat_id, {
          transaction,
        });
        if (!seat) {
          throw new NotFoundException(
            `Không tìm thấy ghế với id ${updateTicketDto.seat_id}`,
          );
        }

        // Kiểm tra xem ghế mới đã được đặt chưa (nếu đang thay đổi ghế)
        if (ticket.seat_id !== updateTicketDto.seat_id) {
          const existingTicket = await this.ticketModel.findOne({
            where: {
              screening_id: ticket.screening_id,
              seat_id: updateTicketDto.seat_id,
            },
            transaction,
          });

          if (existingTicket) {
            throw new BadRequestException(
              `Ghế với id ${updateTicketDto.seat_id} đã được đặt cho suất chiếu này`,
            );
          }
        }
      }

      await ticket.update(updateTicketDto, { transaction });
      await transaction.commit();
      return ticket;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Xóa vé
  async remove(id: number): Promise<void> {
    const transaction = await this.sequelize.transaction();

    try {
      const ticket = await this.findOne(id);

      // Xóa các đơn đồ ăn liên quan
      await this.ticketFoodDrinkModel.destroy({
        where: { ticket_id: id },
        transaction,
      });

      await ticket.destroy({ transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

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
import { Transaction, Op } from 'sequelize';
import { Movie } from 'src/models/movie.model';
import { TheaterRoom } from 'src/models/theater-room.model';
import { Theater } from 'src/models/theater.model';
import { TicketSeat } from '../../models/ticket-seat.model';
import { QR_Code } from '../../models/qr-code.model';

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
    @InjectModel(TicketSeat)
    private ticketSeatModel: typeof TicketSeat,
    private sequelize: Sequelize,
    @InjectModel(Movie) private movieModel: typeof Movie,
    @InjectModel(TheaterRoom) private theaterRoomModel: typeof TheaterRoom,
    @InjectModel(Theater) private theaterModel: typeof Theater,
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

      // Tạo vé mới không có seat_id
      const ticketData = {
        user_id: createTicketDto.user_id,
        screening_id: createTicketDto.screening_id,
        booking_time: new Date(),
      };

      const ticket = await this.ticketModel.create(ticketData, { transaction });

      // Nếu có seat_id trong DTO, thêm nó vào bảng TicketSeats
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
        const existingTicketSeat = await this.ticketSeatModel.findOne({
          where: { seat_id: createTicketDto.seat_id },
          include: [
            {
              model: Ticket,
              where: {
                screening_id: createTicketDto.screening_id,
              },
            },
          ],
          transaction,
        });

        if (existingTicketSeat) {
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

        // Thêm ghế vào bảng TicketSeats
        await this.ticketSeatModel.create(
          {
            ticket_id: ticket.id,
            seat_id: createTicketDto.seat_id,
          },
          { transaction },
        );
      }

      // Commit transaction nếu mọi thứ OK
      await transaction.commit();
      return ticket;
    } catch (error) {
      // Rollback transaction nếu có lỗi
      await transaction.rollback();
      throw error;
    }
  }

  // Tạo vé mới với nhiều ghế ngồi
  async createWithMultipleSeats(
    userId: number,
    screeningId: number,
    seatIds: number[],
    prices?: number[],
  ): Promise<Ticket> {
    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    try {
      const user = await this.userModel.findByPk(userId, { transaction });
      if (!user) {
        throw new NotFoundException(
          `Không tìm thấy người dùng với id ${userId}`,
        );
      }

      const screening = await this.screeningModel.findByPk(screeningId, {
        transaction,
      });
      if (!screening) {
        throw new NotFoundException(
          `Không tìm thấy suất chiếu với id ${screeningId}`,
        );
      }

      // Tạo ticket mới
      const ticket = await this.ticketModel.create(
        {
          user_id: userId,
          screening_id: screeningId,
          booking_time: new Date(),
        },
        { transaction },
      );

      // Thêm từng ghế vào bảng TicketSeats
      for (let i = 0; i < seatIds.length; i++) {
        const seatId = seatIds[i];
        const price = prices && prices[i] ? prices[i] : undefined;

        const seat = await this.seatModel.findByPk(seatId, { transaction });
        if (!seat) {
          throw new NotFoundException(`Không tìm thấy ghế với id ${seatId}`);
        }

        // Kiểm tra xem ghế đã được đặt trong vé khác chưa
        const existingTicketSeats = await this.ticketSeatModel.findAll({
          where: { seat_id: seatId },
          include: [
            {
              model: Ticket,
              where: {
                screening_id: screeningId,
              },
            },
          ],
          transaction,
        });

        // Lọc ra các ghế không thuộc về vé hiện tại
        const otherTicketSeats: TicketSeat[] = [];
        for (const ticketSeat of existingTicketSeats) {
          const ticketForSeat = await ticketSeat.$get('ticket', {
            transaction,
          });
          if (ticketForSeat && ticketForSeat.id !== ticket.id) {
            otherTicketSeats.push(ticketSeat);
          }
        }

        if (otherTicketSeats.length > 0) {
          throw new BadRequestException(
            `Ghế với id ${seatId} đã được đặt cho suất chiếu ${screeningId}`,
          );
        }

        // Kiểm tra đặt chỗ tạm thời
        const reservation = await this.seatReservationModel.findOne({
          where: {
            screening_id: screeningId,
            seat_id: seatId,
          },
          transaction,
        });

        if (
          reservation &&
          new Date(reservation.expires_at) > new Date() &&
          reservation.user_id !== userId
        ) {
          throw new BadRequestException(
            `Ghế với id ${seatId} đang được giữ tạm thời bởi người dùng khác`,
          );
        }

        // Xóa đặt chỗ tạm thời của người dùng hiện tại
        if (reservation && reservation.user_id === userId) {
          await reservation.destroy({ transaction });
        }

        // Thêm ghế vào bảng TicketSeats
        await this.ticketSeatModel.create(
          {
            ticket_id: ticket.id,
            seat_id: seatId,
            price,
          },
          { transaction },
        );
      }

      // Tính tổng giá vé nếu có thông tin về giá
      if (prices && prices.length > 0) {
        const totalPrice = prices.reduce((sum, price) => sum + (price || 0), 0);
        await ticket.update({ total_price: totalPrice }, { transaction });
      }

      await transaction.commit();
      return ticket;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Lấy tất cả vé
  async findAll(): Promise<Ticket[]> {
    return this.ticketModel.findAll({
      include: [
        { model: User },
        { model: Screening, include: [Movie, TheaterRoom] },
        { model: TicketSeat, include: [Seat] },
      ],
    });
  }

  // Lấy một vé theo ID
  async findOne(id: number): Promise<Ticket> {
    const ticket = await this.ticketModel.findByPk(id, {
      include: [
        {
          model: User,
          attributes: { exclude: ['password', 'createdAt', 'updatedAt'] },
        },
        {
          model: Screening,
          include: [
            { model: Movie },
            { model: TheaterRoom, include: [Theater] },
          ],
        },
        { model: TicketSeat, include: [Seat] },
        { model: TicketFoodDrink, include: [FoodDrink] },
        { model: QR_Code, attributes: ['qr_code'] },
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
        {
          model: Screening,
          include: [
            {
              model: Movie,
            },
            {
              model: TheaterRoom,
              include: [Theater],
            },
          ],
        },
        { model: TicketSeat, include: [Seat] },
      ],
      order: [['booking_time', 'DESC']],
    });
  }

  // Cập nhật vé
  async update(id: number, updateTicketDto: UpdateTicketDto): Promise<Ticket> {
    const transaction = await this.sequelize.transaction();

    try {
      const ticket = await this.ticketModel.findByPk(id, { transaction });
      if (!ticket) {
        throw new NotFoundException(`Không tìm thấy vé với id ${id}`);
      }

      await ticket.update(updateTicketDto, { transaction });
      await transaction.commit();
      return ticket;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Tạo vé mới với nhiều ghế ngồi và đồ ăn/đồ uống
  async createWithMultipleSeatsAndFoodDrinks(
    userId: number,
    screeningId: number,
    seatIds: number[],
    prices?: number[],
    foodDrinks?: Array<{ food_drink_id: number; quantity: number }>,
  ): Promise<Ticket> {
    const transaction = await this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    try {
      const user = await this.userModel.findByPk(userId, { transaction });
      if (!user) {
        throw new NotFoundException(
          `Không tìm thấy người dùng với id ${userId}`,
        );
      }

      const screening = await this.screeningModel.findByPk(screeningId, {
        transaction,
      });
      if (!screening) {
        throw new NotFoundException(
          `Không tìm thấy suất chiếu với id ${screeningId}`,
        );
      }

      // Tạo ticket mới
      const ticket = await this.ticketModel.create(
        {
          user_id: userId,
          screening_id: screeningId,
          booking_time: new Date(),
        },
        { transaction },
      );

      // Thêm từng ghế vào bảng TicketSeats
      for (let i = 0; i < seatIds.length; i++) {
        const seatId = seatIds[i];
        const price = prices && prices[i] ? prices[i] : undefined;

        const seat = await this.seatModel.findByPk(seatId, { transaction });
        if (!seat) {
          throw new NotFoundException(`Không tìm thấy ghế với id ${seatId}`);
        }

        // Kiểm tra xem ghế đã được đặt trong vé khác chưa
        const existingTicketSeats = await this.ticketSeatModel.findAll({
          where: { seat_id: seatId },
          include: [
            {
              model: Ticket,
              where: {
                screening_id: screeningId,
              },
            },
          ],
          transaction,
        });

        // Lọc ra các ghế không thuộc về vé hiện tại
        const otherTicketSeats: TicketSeat[] = [];
        for (const ticketSeat of existingTicketSeats) {
          const ticketForSeat = await ticketSeat.$get('ticket', {
            transaction,
          });
          if (ticketForSeat && ticketForSeat.id !== ticket.id) {
            otherTicketSeats.push(ticketSeat);
          }
        }

        if (otherTicketSeats.length > 0) {
          throw new BadRequestException(
            `Ghế với id ${seatId} đã được đặt cho suất chiếu ${screeningId}`,
          );
        }

        // Kiểm tra đặt chỗ tạm thời
        const reservation = await this.seatReservationModel.findOne({
          where: {
            screening_id: screeningId,
            seat_id: seatId,
          },
          transaction,
        });

        if (
          reservation &&
          new Date(reservation.expires_at) > new Date() &&
          reservation.user_id !== userId
        ) {
          throw new BadRequestException(
            `Ghế với id ${seatId} đang được giữ tạm thời bởi người dùng khác`,
          );
        }

        // Xóa đặt chỗ tạm thời của người dùng hiện tại
        if (reservation && reservation.user_id === userId) {
          await reservation.destroy({ transaction });
        }

        // Thêm ghế vào bảng TicketSeats
        await this.ticketSeatModel.create(
          {
            ticket_id: ticket.id,
            seat_id: seatId,
            price,
          },
          { transaction },
        );
      }

      // Tính tổng giá vé từ ghế ngồi
      let totalPrice = 0;
      if (prices && prices.length > 0) {
        totalPrice = prices.reduce((sum, price) => sum + (price || 0), 0);
      }

      // Xử lý đồ ăn/đồ uống nếu có
      if (foodDrinks && foodDrinks.length > 0) {
        let foodDrinkTotal = 0;

        for (const item of foodDrinks) {
          // Tìm thông tin đồ ăn/đồ uống
          const foodDrink = await this.foodDrinkModel.findByPk(
            item.food_drink_id,
            { transaction },
          );

          if (!foodDrink) {
            throw new NotFoundException(
              `Không tìm thấy đồ ăn/đồ uống với id ${item.food_drink_id}`,
            );
          }

          if (!foodDrink.is_available) {
            throw new BadRequestException(
              `Đồ ăn/đồ uống "${foodDrink.name}" hiện không có sẵn`,
            );
          }

          // Kiểm tra số lượng trong kho nếu áp dụng
          if (
            foodDrink.stock_quantity !== null &&
            foodDrink.stock_quantity < item.quantity
          ) {
            throw new BadRequestException(
              `Không đủ số lượng cho "${foodDrink.name}". Có sẵn: ${foodDrink.stock_quantity}, Yêu cầu: ${item.quantity}`,
            );
          }

          // Tính tổng giá của món
          const itemTotal = foodDrink.price * item.quantity;
          foodDrinkTotal += itemTotal;

          // Tạo bản ghi trong bảng TicketFoodDrink
          await this.ticketFoodDrinkModel.create(
            {
              ticket_id: ticket.id,
              food_drink_id: item.food_drink_id,
              quantity: item.quantity,
              unit_price: foodDrink.price,
              total_price: itemTotal,
              status: 'pending',
            },
            { transaction },
          );

          // Cập nhật số lượng trong kho nếu áp dụng
          if (foodDrink.stock_quantity !== null) {
            await foodDrink.update(
              {
                stock_quantity: foodDrink.stock_quantity - item.quantity,
              },
              { transaction },
            );
          }
        }

        // Cập nhật tổng giá vé bao gồm cả đồ ăn/đồ uống
        totalPrice += foodDrinkTotal;
      }

      // Cập nhật tổng giá vé
      await ticket.update({ total_price: totalPrice }, { transaction });

      await transaction.commit();
      return this.findOne(ticket.id); // Trả về vé đã bao gồm đầy đủ thông tin
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Xóa vé
  async remove(id: number): Promise<void> {
    const transaction = await this.sequelize.transaction();

    try {
      const ticket = await this.ticketModel.findByPk(id, { transaction });
      if (!ticket) {
        throw new NotFoundException(`Không tìm thấy vé với id ${id}`);
      }

      // Xóa các liên kết với ghế
      await this.ticketSeatModel.destroy({
        where: { ticket_id: id },
        transaction,
      });

      // Xóa vé
      await ticket.destroy({ transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getTicketsWithFoodDrinks(userId: number) {
    return this.ticketModel.findAll({
      where: { user_id: userId },
      include: [
        {
          model: this.screeningModel,
          include: [
            {
              model: this.movieModel,
              attributes: ['id', 'title', 'poster_path'],
            },
            {
              model: this.theaterRoomModel,
              include: [
                {
                  model: this.theaterModel,
                  attributes: ['id', 'name'],
                },
              ],
            },
          ],
        },
        {
          model: this.ticketSeatModel,
          include: [
            {
              model: this.seatModel,
              attributes: ['id', 'seat_row', 'seat_number', 'seat_type'],
            },
          ],
        },
        {
          model: this.ticketFoodDrinkModel,
          include: [
            {
              model: this.foodDrinkModel,
              attributes: ['id', 'name', 'price', 'image_url', 'category'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  // Xóa vé chưa thanh toán và SeatReservation liên quan cho user và screeningId
  async cleanupUserPendingTickets(userId: number, screeningId: number) {
    // Xóa vé chưa thanh toán
    const tickets = await this.ticketModel.findAll({
      where: {
        user_id: userId,
        screening_id: screeningId,
        status: ['booked'],
      },
    });
    for (const ticket of tickets) {
      await this.ticketSeatModel.destroy({ where: { ticket_id: ticket.id } });
      await ticket.destroy();
    }
    // Xóa SeatReservation
    await this.seatReservationModel.destroy({
      where: { user_id: userId, screening_id: screeningId },
    });
  }

  async verifyTicketByQRCode(qr_code: string) {
    let qrData: any;
    try {
      qrData = JSON.parse(qr_code);
    } catch (e) {
      throw new BadRequestException('QR code không hợp lệ (không phải JSON)');
    }
    if (!qrData.ticket_id) {
      throw new BadRequestException('QR code thiếu ticket_id');
    }
    // 1. Tìm vé theo ticket_id
    const ticket = await this.ticketModel.findByPk(qrData.ticket_id, {
      include: [
        {
          association: 'screening',
          include: [
            { association: 'movie' },
            {
              association: 'theaterRoom',
              include: [{ association: 'theater' }],
            },
          ],
        },
        { association: 'ticketSeats', include: [{ association: 'seat' }] },
      ],
    });
    if (!ticket) throw new NotFoundException('Không tìm thấy vé');

    // Kiểm tra thời gian suất chiếu
    const now = new Date();
    const startTime = new Date(ticket.screening.start_time);
    const endTime = new Date(ticket.screening.end_time);
    const startTimeMinus15 = new Date(startTime.getTime() - 15 * 60 * 1000);

    if (now < startTimeMinus15) {
      return {
        success: false,
        message: 'Chưa đến giờ chiếu, vui lòng đợi.',
        ticket,
      };
    }
    if (now > endTime) {
      return { success: false, message: 'Vé đã hết hạn.', ticket };
    }
    // Nếu hợp lệ, cập nhật trạng thái vé là đã sử dụng
    ticket.status = 'used';
    await ticket.save();

    // 4. Trả về thông tin vé và thông tin QR code
    return {
      success: true,
      message: 'Vé hợp lệ, đã cập nhật trạng thái',
      ticket,
      qr_info: qrData,
    };
  }
}

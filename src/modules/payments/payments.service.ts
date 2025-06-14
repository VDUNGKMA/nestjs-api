// src/modules/payments/payment.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Payment } from '../../models/payment.model';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Ticket } from '../../models/ticket.model';
import { User } from '../../models/user.model';
import { SeatReservation } from '../../models/seat-reservation.model';
import { TicketFoodDrink } from '../../models/ticket-food-drink.model';
import { FoodDrink } from '../../models/food-drink.model';
import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { FoodDrinksService } from '../food-drinks/food-drinks.service';
import { TicketSeat } from '../../models/ticket-seat.model';
import { QRCodeService } from '../qr-codes/qr-codes.service';
import * as QRCode from 'qrcode';

@Injectable()
export class PaymentService {
  private foodDrinkModel: typeof FoodDrink;
  private ticketFoodDrinkModel: typeof TicketFoodDrink;

  constructor(
    @InjectModel(Payment)
    private paymentModel: typeof Payment,
    @InjectModel(Ticket)
    private ticketModel: typeof Ticket,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(SeatReservation)
    private seatReservationModel: typeof SeatReservation,
    @InjectModel(TicketSeat)
    private ticketSeatModel: typeof TicketSeat,
    private sequelize: Sequelize,
    private qrCodeService: QRCodeService,
  ) {
    // Truy cập các model qua Sequelize
    this.foodDrinkModel = this.sequelize.models.FoodDrinks as typeof FoodDrink;
    this.ticketFoodDrinkModel = this.sequelize.models
      .TicketFoodDrinks as typeof TicketFoodDrink;
  }

  private async getTicketWithFoodDrinks(
    ticketId: number,
    transaction?: Transaction,
  ) {
    const ticket = await this.ticketModel.findByPk(ticketId, {
      transaction,
      include: [
        {
          model: TicketFoodDrink,
          include: [FoodDrink],
        },
      ],
    });
    return ticket;
  }

  // Tạo thanh toán mới
  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    // Thêm cơ chế thử lại cho lỗi serialization (tối đa 3 lần)
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any;

    while (retryCount < maxRetries) {
      try {
        // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
        const transaction = await this.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED, // Giảm mức cô lập
        });

        try {
          const ticket = await this.getTicketWithFoodDrinks(
            createPaymentDto.ticket_id,
            transaction,
          );

          if (!ticket) {
            throw new NotFoundException(
              `Không tìm thấy vé với id ${createPaymentDto.ticket_id}`,
            );
          }

          const user = await this.userModel.findByPk(createPaymentDto.user_id, {
            transaction,
          });
          if (!user) {
            throw new NotFoundException(
              `Không tìm thấy người dùng với id ${createPaymentDto.user_id}`,
            );
          }

          // Kiểm tra xem transaction_id đã tồn tại chưa
          if (createPaymentDto.transaction_id) {
            const existingPayment = await this.paymentModel.findOne({
              where: {
                transaction_id: createPaymentDto.transaction_id,
                ticket_id: createPaymentDto.ticket_id,
              },
              transaction,
            });

            if (existingPayment) {
              throw new BadRequestException(
                `Vé với id ${createPaymentDto.ticket_id} đã được thanh toán với mã giao dịch ${createPaymentDto.transaction_id}`,
              );
            }

            // Không cần kiểm tra transaction_id tồn tại ở các vé khác
            // Cho phép thanh toán nhiều vé với cùng một transaction_id
          }

          // Kiểm tra xem vé đã được thanh toán chưa
          if (ticket.status === 'paid') {
            throw new BadRequestException(
              `Vé với id ${ticket.id} đã được thanh toán`,
            );
          }

          // Tính thêm giá của đồ ăn nếu có
          let totalFoodDrinkAmount = 0;
          if (ticket.foodDrinks && ticket.foodDrinks.length > 0) {
            totalFoodDrinkAmount = ticket.foodDrinks.reduce((total, item) => {
              return total + item.unit_price * item.quantity;
            }, 0);
          }

          // Cập nhật tổng tiền thanh toán nếu không được chỉ định
          const updatedAmount =
            createPaymentDto.amount || ticket.total_price || 0; // Sử dụng tổng giá từ ticket

          const paymentData = {
            ...createPaymentDto,
            amount: updatedAmount,
            payment_status: createPaymentDto.payment_status || 'pending',
            payment_method: createPaymentDto.payment_method || undefined,
          };

          // Tạo thanh toán
          const payment = await this.paymentModel.create(paymentData, {
            transaction,
          });

          // Nếu thanh toán thành công, cập nhật trạng thái vé
          if (payment.payment_status === 'completed') {
            await ticket.update({ status: 'paid' }, { transaction });

            // Tự động sinh QR code nếu chưa có
            try {
              const existingQRCode = await this.qrCodeService[
                'qrCodeModel'
              ].findOne({ where: { ticket_id: ticket.id }, transaction });
              if (!existingQRCode) {
                // Dữ liệu QR code có thể là ticket_id hoặc thông tin mã hóa khác
                const qrPayload = JSON.stringify({ ticket_id: ticket.id });
                const qr_code = await QRCode.toDataURL(qrPayload);
                await this.qrCodeService.create({
                  ticket_id: ticket.id,
                  qr_code,
                });
              }
            } catch (err) {
              // Log lỗi nhưng không làm fail thanh toán
              console.error('Lỗi sinh QR code:', err);
            }

            // Cập nhật trạng thái đơn đồ ăn nếu có
            if (ticket.foodDrinks && ticket.foodDrinks.length > 0) {
              for (const item of ticket.foodDrinks) {
                await item.update({ status: 'pending' }, { transaction });
              }
            }

            // Lấy tất cả các ghế liên quan đến vé này từ bảng TicketSeats
            const ticketSeats = await this.ticketSeatModel.findAll({
              where: { ticket_id: ticket.id },
              transaction,
            });

            // Xóa bất kỳ đặt chỗ tạm thời nào liên quan đến các ghế trong vé này
            if (ticketSeats && ticketSeats.length > 0) {
              for (const ticketSeat of ticketSeats) {
                await this.seatReservationModel.destroy({
                  where: {
                    user_id: ticket.user_id,
                    screening_id: ticket.screening_id,
                    seat_id: ticketSeat.seat_id,
                  },
                  transaction,
                });
              }
            }
          }

          await transaction.commit();
          return payment;
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      } catch (error) {
        // Kiểm tra nếu lỗi là serialization error (40001), thử lại
        const pgError = error?.original || error?.parent;
        if (pgError?.code === '40001') {
          retryCount++;
          lastError = error;
          // console.log(
          //   `Serialization error occurred, retrying (${retryCount}/${maxRetries})...`,
          // );
          // Chờ một khoảng thời gian ngẫu nhiên trước khi thử lại để giảm xung đột
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * Math.random() * retryCount),
          );
        } else {
          // Nếu không phải lỗi serialization, ném lại lỗi
          throw error;
        }
      }
    }

    // Nếu đã thử lại đủ số lần và vẫn thất bại
    throw new BadRequestException(
      `Failed after ${maxRetries} attempts: ${lastError?.message || 'Database serialization error'}`,
    );
  }

  // Lấy tất cả thanh toán
  async findAll(): Promise<Payment[]> {
    return this.paymentModel.findAll({
      include: [
        {
          model: Ticket,
          include: [
            {
              model: TicketFoodDrink,
              include: [FoodDrink],
            },
          ],
        },
        { model: User },
      ],
    });
  }

  // Lấy một thanh toán theo ID
  async findOne(id: number): Promise<Payment> {
    const payment = await this.paymentModel.findByPk(id, {
      include: [
        {
          model: Ticket,
          include: [
            {
              model: TicketFoodDrink,
              include: [FoodDrink],
            },
          ],
        },
        { model: User },
      ],
    });
    if (!payment) {
      throw new NotFoundException(`Không tìm thấy thanh toán với id ${id}`);
    }
    return payment;
  }

  // Cập nhật thanh toán
  async update(
    id: number,
    updatePaymentDto: UpdatePaymentDto,
  ): Promise<Payment> {
    // Thêm cơ chế thử lại cho lỗi serialization (tối đa 3 lần)
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any;

    while (retryCount < maxRetries) {
      try {
        const transaction = await this.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
        });

        try {
          const payment = await this.findOne(id);

          if (updatePaymentDto.ticket_id) {
            const ticket = await this.ticketModel.findByPk(
              updatePaymentDto.ticket_id,
              { transaction },
            );
            if (!ticket) {
              throw new NotFoundException(
                `Không tìm thấy vé với id ${updatePaymentDto.ticket_id}`,
              );
            }
          }

          if (updatePaymentDto.user_id) {
            const user = await this.userModel.findByPk(
              updatePaymentDto.user_id,
              {
                transaction,
              },
            );
            if (!user) {
              throw new NotFoundException(
                `Không tìm thấy người dùng với id ${updatePaymentDto.user_id}`,
              );
            }
          }

          if (updatePaymentDto.transaction_id) {
            const existingPayment = await this.paymentModel.findOne({
              where: { transaction_id: updatePaymentDto.transaction_id },
              transaction,
            });
            if (existingPayment && existingPayment.id !== id) {
              throw new BadRequestException(
                `Mã giao dịch ${updatePaymentDto.transaction_id} đã tồn tại`,
              );
            }
          }

          // Lưu trạng thái cũ của thanh toán để xử lý nếu có thay đổi trạng thái
          const oldStatus = payment.payment_status;

          // Cập nhật thanh toán
          await payment.update(updatePaymentDto, { transaction });

          // Nếu trạng thái thanh toán thay đổi thành 'completed'
          if (
            updatePaymentDto.payment_status === 'completed' &&
            oldStatus !== 'completed'
          ) {
            // Cập nhật trạng thái vé
            const ticket = await this.ticketModel.findByPk(payment.ticket_id, {
              transaction,
              include: [
                {
                  model: TicketFoodDrink,
                },
                {
                  model: TicketSeat,
                },
              ],
            });

            if (ticket && ticket.status !== 'paid') {
              await ticket.update({ status: 'paid' }, { transaction });

              // Cập nhật trạng thái đơn đồ ăn nếu có
              if (ticket.foodDrinks && ticket.foodDrinks.length > 0) {
                for (const item of ticket.foodDrinks) {
                  await item.update({ status: 'pending' }, { transaction });
                }
              }

              // Lấy tất cả các ghế liên quan đến vé này từ bảng TicketSeats
              const ticketSeats = await this.ticketSeatModel.findAll({
                where: { ticket_id: ticket.id },
                transaction,
              });

              // Xóa bất kỳ đặt chỗ tạm thời nào liên quan đến các ghế trong vé này
              if (ticketSeats && ticketSeats.length > 0) {
                for (const ticketSeat of ticketSeats) {
                  await this.seatReservationModel.destroy({
                    where: {
                      user_id: ticket.user_id,
                      screening_id: ticket.screening_id,
                      seat_id: ticketSeat.seat_id,
                    },
                    transaction,
                  });
                }
              }
            }
          }

          await transaction.commit();
          return payment;
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      } catch (error) {
        // Kiểm tra nếu lỗi là serialization error (40001), thử lại
        const pgError = error?.original || error?.parent;
        if (pgError?.code === '40001') {
          retryCount++;
          lastError = error;
          // console.log(
          //   `Serialization error occurred, retrying (${retryCount}/${maxRetries})...`,
          // );
          // Chờ một khoảng thời gian ngẫu nhiên trước khi thử lại để giảm xung đột
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * Math.random() * retryCount),
          );
        } else {
          // Nếu không phải lỗi serialization, ném lại lỗi
          throw error;
        }
      }
    }

    // Nếu đã thử lại đủ số lần và vẫn thất bại
    throw new BadRequestException(
      `Failed after ${maxRetries} attempts: ${lastError?.message || 'Database serialization error'}`,
    );
  }

  // Xóa thanh toán
  async remove(id: number): Promise<void> {
    // Thêm cơ chế thử lại cho lỗi serialization (tối đa 3 lần)
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any;

    while (retryCount < maxRetries) {
      try {
        const transaction = await this.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
        });

        try {
          const payment = await this.findOne(id);
          await payment.destroy({ transaction });
          await transaction.commit();
          return;
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      } catch (error) {
        // Kiểm tra nếu lỗi là serialization error (40001), thử lại
        const pgError = error?.original || error?.parent;
        if (pgError?.code === '40001') {
          retryCount++;
          lastError = error;
          // console.log(
          //   `Serialization error occurred, retrying (${retryCount}/${maxRetries})...`,
          // );
          // Chờ một khoảng thời gian ngẫu nhiên trước khi thử lại để giảm xung đột
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * Math.random() * retryCount),
          );
        } else {
          // Nếu không phải lỗi serialization, ném lại lỗi
          throw error;
        }
      }
    }

    // Nếu đã thử lại đủ số lần và vẫn thất bại
    throw new BadRequestException(
      `Failed after ${maxRetries} attempts: ${lastError?.message || 'Database serialization error'}`,
    );
  }

  // Tìm thanh toán theo transaction_id
  async findByTransactionId(transactionId: string): Promise<Payment[]> {
    return this.paymentModel.findAll({
      where: { transaction_id: transactionId },
      include: [
        {
          model: Ticket,
          include: [
            {
              model: TicketFoodDrink,
              include: [FoodDrink],
            },
          ],
        },
        { model: User },
      ],
    });
  }
}

// src/modules/payments/payment.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Payment } from '../../models/payment.model';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Ticket } from '../../models/ticket.model';
import { User } from '../../models/user.model';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment) private paymentModel: typeof Payment,
    @InjectModel(Ticket) private ticketModel: typeof Ticket,
    @InjectModel(User) private userModel: typeof User,
  ) {}

  // Tạo thanh toán mới
  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const ticket = await this.ticketModel.findByPk(createPaymentDto.ticket_id);
    if (!ticket) {
      throw new NotFoundException(
        `Không tìm thấy vé với id ${createPaymentDto.ticket_id}`,
      );
    }

    const user = await this.userModel.findByPk(createPaymentDto.user_id);
    if (!user) {
      throw new NotFoundException(
        `Không tìm thấy người dùng với id ${createPaymentDto.user_id}`,
      );
    }

    if (createPaymentDto.transaction_id) {
      const existingPayment = await this.paymentModel.findOne({
        where: { transaction_id: createPaymentDto.transaction_id },
      });
      if (existingPayment) {
        throw new BadRequestException(
          `Mã giao dịch ${createPaymentDto.transaction_id} đã tồn tại`,
        );
      }
    }

    const paymentData = {
      ...createPaymentDto,
      payment_status: createPaymentDto.payment_status || 'pending',
      payment_method: createPaymentDto.payment_method || undefined, // Thêm giá trị mặc định
    };

    return this.paymentModel.create(paymentData);
  }

  // Lấy tất cả thanh toán
  async findAll(): Promise<Payment[]> {
    return this.paymentModel.findAll();
  }

  // Lấy một thanh toán theo ID
  async findOne(id: number): Promise<Payment> {
    const payment = await this.paymentModel.findByPk(id);
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
    const payment = await this.findOne(id);

    if (updatePaymentDto.ticket_id) {
      const ticket = await this.ticketModel.findByPk(
        updatePaymentDto.ticket_id,
      );
      if (!ticket) {
        throw new NotFoundException(
          `Không tìm thấy vé với id ${updatePaymentDto.ticket_id}`,
        );
      }
    }

    if (updatePaymentDto.user_id) {
      const user = await this.userModel.findByPk(updatePaymentDto.user_id);
      if (!user) {
        throw new NotFoundException(
          `Không tìm thấy người dùng với id ${updatePaymentDto.user_id}`,
        );
      }
    }

    if (updatePaymentDto.transaction_id) {
      const existingPayment = await this.paymentModel.findOne({
        where: { transaction_id: updatePaymentDto.transaction_id },
      });
      if (existingPayment && existingPayment.id !== id) {
        throw new BadRequestException(
          `Mã giao dịch ${updatePaymentDto.transaction_id} đã tồn tại`,
        );
      }
    }

    await payment.update(updatePaymentDto);
    return payment;
  }

  // Xóa thanh toán
  async remove(id: number): Promise<void> {
    const payment = await this.findOne(id);
    await payment.destroy();
  }
}

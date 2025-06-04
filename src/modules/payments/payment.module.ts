// src/modules/payments/payment.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Payment } from '../../models/payment.model';
import { Ticket } from '../../models/ticket.model';
import { User } from '../../models/user.model';
import { PaymentService } from './payments.service';
import { PaymentController } from './payments.controller';
import { SeatReservation } from '../../models/seat-reservation.model';
import { PayPalService } from './paypal.service';
import { TicketSeat } from '../../models/ticket-seat.model';
import { QRCodeModule } from '../qr-codes/qr-codes.module';
import { QRCodeService } from '../qr-codes/qr-codes.service';
import { QR_Code } from '../../models/qr-code.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Payment,
      Ticket,
      User,
      SeatReservation,
      TicketSeat,
      QR_Code,
    ]),
    QRCodeModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PayPalService, QRCodeService],
  exports: [PaymentService, PayPalService],
})
export class PaymentModule {}

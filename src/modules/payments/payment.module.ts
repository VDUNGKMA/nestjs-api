// src/modules/payments/payment.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Payment } from '../../models/payment.model';
import { Ticket } from '../../models/ticket.model';
import { User } from '../../models/user.model';
import { PaymentService } from './payments.service';
import { PaymentController } from './payments.controller';

@Module({
  imports: [SequelizeModule.forFeature([Payment, Ticket, User])],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}

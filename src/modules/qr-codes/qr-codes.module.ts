// src/modules/qr-codes/qr-code.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { QR_Code } from '../../models/qr-code.model';
import { Ticket } from '../../models/ticket.model';
import { QRCodeService } from './qr-codes.service';
import { QRCodeController } from './qr-codes.controller';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';

@Module({
  imports: [SequelizeModule.forFeature([QR_Code, Ticket])],
  controllers: [QRCodeController],
  providers: [QRCodeService, JwtAuthGuard],
})
export class QRCodeModule {}

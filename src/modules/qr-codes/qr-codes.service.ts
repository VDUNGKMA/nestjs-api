// src/modules/qr-codes/qr-code.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QR_Code, QRCodeAttributes } from '../../models/qr-code.model';
import { CreateQRCodeDto } from './dto/create-qr-code.dto';
import { UpdateQRCodeDto } from './dto/update-qr-code.dto';
import { Ticket } from '../../models/ticket.model';

@Injectable()
export class QRCodeService {
  constructor(
    @InjectModel(QR_Code) private qrCodeModel: typeof QR_Code,
    @InjectModel(Ticket) private ticketModel: typeof Ticket,
  ) {}

  // Tạo QR code mới
  async create(createQRCodeDto: CreateQRCodeDto): Promise<QR_Code> {
    const ticket = await this.ticketModel.findByPk(createQRCodeDto.ticket_id);
    if (!ticket) {
      throw new NotFoundException(
        `Không tìm thấy vé với id ${createQRCodeDto.ticket_id}`,
      );
    }

    // Kiểm tra xem vé đã có QR code chưa (tùy chọn, tùy theo nghiệp vụ)
    const existingQRCode = await this.qrCodeModel.findOne({
      where: { ticket_id: createQRCodeDto.ticket_id },
    });
    if (existingQRCode) {
      throw new BadRequestException(
        `Vé với id ${createQRCodeDto.ticket_id} đã có QR code`,
      );
    }

    const qrCodeData: QRCodeAttributes = {
      ticket_id: createQRCodeDto.ticket_id,
      qr_code: createQRCodeDto.qr_code,
    };

    return this.qrCodeModel.create(qrCodeData);
  }

  // Lấy tất cả QR code
  async findAll(): Promise<QR_Code[]> {
    return this.qrCodeModel.findAll();
  }

  // Lấy một QR code theo ID
  async findOne(id: number): Promise<QR_Code> {
    const qrCode = await this.qrCodeModel.findByPk(id);
    if (!qrCode) {
      throw new NotFoundException(`Không tìm thấy QR code với id ${id}`);
    }
    return qrCode;
  }

  // Cập nhật QR code
  async update(id: number, updateQRCodeDto: UpdateQRCodeDto): Promise<QR_Code> {
    const qrCode = await this.findOne(id);

    if (updateQRCodeDto.ticket_id) {
      const ticket = await this.ticketModel.findByPk(updateQRCodeDto.ticket_id);
      if (!ticket) {
        throw new NotFoundException(
          `Không tìm thấy vé với id ${updateQRCodeDto.ticket_id}`,
        );
      }

      const existingQRCode = await this.qrCodeModel.findOne({
        where: { ticket_id: updateQRCodeDto.ticket_id },
      });
      if (existingQRCode && existingQRCode.id !== id) {
        throw new BadRequestException(
          `Vé với id ${updateQRCodeDto.ticket_id} đã có QR code khác`,
        );
      }
    }

    await qrCode.update(updateQRCodeDto);
    return qrCode;
  }

  // Xóa QR code
  async remove(id: number): Promise<void> {
    const qrCode = await this.findOne(id);
    await qrCode.destroy();
  }
}

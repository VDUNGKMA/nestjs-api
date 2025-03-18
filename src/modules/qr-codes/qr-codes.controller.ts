// src/modules/qr-codes/qr-code.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { QRCodeService } from './qr-codes.service';
import { CreateQRCodeDto } from './dto/create-qr-code.dto';
import { UpdateQRCodeDto } from './dto/update-qr-code.dto';

@Controller('qr-codes')
export class QRCodeController {
  constructor(private readonly qrCodeService: QRCodeService) {}

  @Post()
  create(@Body() createQRCodeDto: CreateQRCodeDto) {
    return this.qrCodeService.create(createQRCodeDto);
  }

  @Get()
  findAll() {
    return this.qrCodeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.qrCodeService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateQRCodeDto: UpdateQRCodeDto,
  ) {
    return this.qrCodeService.update(id, updateQRCodeDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.qrCodeService.remove(id);
  }
}

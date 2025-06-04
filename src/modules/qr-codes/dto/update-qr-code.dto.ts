// src/modules/qr-codes/dto/update-qr-code.dto.ts
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class UpdateQRCodeDto {
  @IsNumber()
  @IsOptional()
  ticket_id?: number;

  @IsString()
  @IsOptional()
  qr_code?: string;
}

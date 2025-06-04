// src/modules/qr-codes/dto/create-qr-code.dto.ts
import { IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class CreateQRCodeDto {
  @IsNumber()
  @IsNotEmpty()
  ticket_id: number;

  @IsString()
  @IsNotEmpty()
  qr_code: string;
}

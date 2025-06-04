// src/modules/payments/dto/update-payment.dto.ts
import { IsNumber, IsEnum, IsString, IsOptional } from 'class-validator';

export class UpdatePaymentDto {
  @IsNumber()
  @IsOptional()
  ticket_id?: number;

  @IsNumber()
  @IsOptional()
  user_id?: number;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsEnum(['pending', 'completed', 'failed'])
  @IsOptional()
  payment_status?: 'pending' | 'completed' | 'failed';

  @IsString()
  @IsOptional()
  transaction_id?: string;

  @IsEnum(['Momo', 'Visa', 'Cash'])
  @IsOptional()
  payment_method?: 'Momo' | 'Visa' | 'Cash';
}

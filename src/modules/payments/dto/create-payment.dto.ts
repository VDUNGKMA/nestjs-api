// src/modules/payments/dto/create-payment.dto.ts
import {
  IsNumber,
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  @IsNotEmpty()
  ticket_id: number;

  @IsNumber()
  @IsNotEmpty()
  user_id: number;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsEnum(['pending', 'completed', 'failed'])
  @IsOptional()
  payment_status?: 'pending' | 'completed' | 'failed';

  @IsString()
  @IsOptional()
  transaction_id?: string;

  @IsEnum(['Momo', 'Visa', 'Cash', 'PayPal'])
  @IsOptional()
  payment_method?: 'Momo' | 'Visa' | 'Cash' | 'PayPal';
}

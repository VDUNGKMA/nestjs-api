import { IsNumber, IsEnum, IsOptional } from 'class-validator';

export class UpdateTicketDto {
  @IsNumber()
  @IsOptional()
  user_id?: number;

  @IsNumber()
  @IsOptional()
  screening_id?: number;

  @IsEnum(['booked', 'paid', 'cancelled'])
  @IsOptional()
  status?: 'booked' | 'paid' | 'cancelled';

  @IsNumber()
  @IsOptional()
  total_price?: number;
}

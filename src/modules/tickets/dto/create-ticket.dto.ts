
import { IsNumber, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTicketDto {
  @IsNumber()
  @IsNotEmpty()
  user_id: number;

  @IsNumber()
  @IsNotEmpty()
  screening_id: number;

  @IsNumber()
  @IsOptional()
  seat_id?: number;

  @IsEnum(['booked', 'paid', 'cancelled'])
  @IsOptional()
  status?: 'booked' | 'paid' | 'cancelled';
}

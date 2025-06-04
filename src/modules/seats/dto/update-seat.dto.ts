
import { IsNumber, IsString, IsEnum, IsOptional } from 'class-validator';

export class UpdateSeatDto {
  @IsNumber()
  @IsOptional()
  theater_room_id?: number;

  @IsString()
  @IsOptional()
  seat_row?: string;

  @IsNumber()
  @IsOptional()
  seat_number?: number;

  @IsEnum(['regular', 'vip', 'deluxe'])
  @IsOptional()
  seat_type?: 'regular' | 'vip' | 'deluxe';

  @IsNumber()
  @IsOptional()
  price?: number;
}


import { IsNumber, IsString, IsEnum, IsNotEmpty } from 'class-validator';

export class CreateSeatDto {
  @IsNumber()
  @IsNotEmpty()
  theater_room_id: number;

  @IsString()
  @IsNotEmpty()
  seat_row: string;

  @IsNumber()
  @IsNotEmpty()
  seat_number: number;

  @IsEnum(['regular', 'vip', 'deluxe'])
  @IsNotEmpty()
  seat_type: 'regular' | 'vip' | 'deluxe';

  @IsNumber()
  @IsNotEmpty()
  price: number;
}

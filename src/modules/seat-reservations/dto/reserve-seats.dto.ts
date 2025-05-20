import { IsNumber, IsArray, IsNotEmpty } from 'class-validator';

export class ReserveSeatsDto {
  @IsNumber()
  @IsNotEmpty()
  screeningId: number;

  @IsArray()
  @IsNotEmpty()
  seatIds: number[];

  @IsNumber()
  @IsNotEmpty()
  userId: number;
}

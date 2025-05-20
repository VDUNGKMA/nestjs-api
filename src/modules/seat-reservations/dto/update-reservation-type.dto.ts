import { IsNumber, IsArray, IsEnum } from 'class-validator';
import { ReservationType } from './create-seat-reservation.dto';

export class UpdateReservationTypeDto {
  @IsNumber()
  user_id: number;

  @IsNumber()
  screening_id: number;

  @IsArray()
  @IsNumber({}, { each: true })
  seat_ids: number[];

  @IsEnum(ReservationType)
  reservation_type: ReservationType;
}

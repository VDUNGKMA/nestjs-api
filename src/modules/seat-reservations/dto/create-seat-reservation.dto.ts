import {
  IsNumber,
  IsEnum,
  IsNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export enum ReservationType {
  TEMPORARY = 'temporary',
  PROCESSING_PAYMENT = 'processing_payment',
}

export class CreateSeatReservationDto {
  @IsNumber()
  @IsNotEmpty()
  user_id: number;

  @IsNumber()
  @IsNotEmpty()
  screening_id: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  seat_ids: number[];

  @IsEnum(ReservationType)
  @IsNotEmpty()
  reservation_type: ReservationType;

  @IsBoolean()
  @IsOptional()
  suggest_alternatives?: boolean = true;

  @IsBoolean()
  @IsOptional()
  require_all?: boolean = false;

  @IsOptional()
  @IsNumber()
  request_timestamp?: number;
}

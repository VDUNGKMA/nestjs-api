// src/screenings/dto/create-screening.dto.ts
import { IsNumber, IsDateString, IsNotEmpty } from 'class-validator';

export class CreateScreeningDto {
  @IsNumber()
  @IsNotEmpty()
  movie_id: number;

  @IsNumber()
  @IsNotEmpty()
  theater_room_id: number;

  @IsDateString()
  @IsNotEmpty()
  start_time: Date;

  @IsDateString()
  @IsNotEmpty()
  end_time: Date;

  @IsNumber()
  @IsNotEmpty()
  price: number;
}

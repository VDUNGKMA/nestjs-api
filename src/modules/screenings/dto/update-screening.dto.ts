// src/screenings/dto/update-screening.dto.ts
import { IsNumber, IsDateString, IsOptional } from 'class-validator';

export class UpdateScreeningDto {
  @IsNumber()
  @IsOptional()
  movie_id?: number;

  @IsNumber()
  @IsOptional()
  theater_room_id?: number;

  @IsDateString()
  @IsOptional()
  start_time?: Date;

  @IsDateString()
  @IsOptional()
  end_time?: Date;

  @IsNumber()
  @IsOptional()
  price?: number;
}

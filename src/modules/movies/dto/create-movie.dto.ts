// src/dto/create-movie.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsDateString,
  IsArray,
} from 'class-validator';

export class CreateMovieDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  duration: number;

  @IsDateString()
  release_date: Date;

  @IsOptional()
  @IsInt()
  age_restriction?: number;

  @IsOptional()
  @IsString()
  director?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cast?: string[];

  @IsOptional()
  @IsString()
  poster_url?: string;

  @IsOptional()
  @IsString()
  trailer_url?: string;
  
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  genreIds?: number[]; // Thêm trường genreIds
}

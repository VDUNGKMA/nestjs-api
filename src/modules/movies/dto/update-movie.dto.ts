import { IsString, IsOptional, IsInt, IsDateString, IsArray } from 'class-validator';

export class UpdateMovieDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  duration?: number; // Thời lượng phim (phút)

  @IsOptional()
  @IsDateString()
  release_date?: Date;

  @IsOptional()
  @IsInt()
  age_restriction?: number;

  @IsOptional()
  @IsString()
  director?: string;

  // @IsOptional()
  // @IsString()
  // cast?: string | string[];
  @IsOptional()
  @IsString({ each: true }) // Giả sử bạn cho phép là mảng chuỗi
  cast?: string | string[];

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

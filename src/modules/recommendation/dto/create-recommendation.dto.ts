import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateRecommendationDto {
  @ApiProperty({
    description: 'ID của phim được gợi ý',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  movie_id: number;

  @ApiProperty({
    description: 'Loại gợi ý',
    example: 'content-based',
  })
  @IsNotEmpty()
  @IsString()
  recommendation_type: string;

  @ApiProperty({
    description: 'Điểm dự đoán mức độ phù hợp',
    example: 0.85,
  })
  @IsNotEmpty()
  @IsNumber()
  score: number;

  @ApiProperty({
    description: 'Dữ liệu ngữ cảnh khi đưa ra gợi ý',
    example: { weather: 'rainy', time: 'evening', location: 'home' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  context_data?: any;

  @ApiProperty({
    description: 'Người dùng đã nhấp vào gợi ý chưa',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_clicked?: boolean;

  @ApiProperty({
    description: 'Người dùng đã đặt vé cho phim được gợi ý chưa',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_booked?: boolean;
}
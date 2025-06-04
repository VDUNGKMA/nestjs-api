import { IsNumber, IsEnum, IsNotEmpty, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class FoodDrinkItem {
  @ApiProperty({ description: 'ID của món đồ ăn/đồ uống' })
  @IsNumber()
  food_drink_id: number;

  @ApiProperty({ description: 'Số lượng', example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateTicketDto {
  @ApiProperty({ description: 'ID của người dùng đặt vé' })
  @IsNumber()
  @IsNotEmpty()
  user_id: number;

  @ApiProperty({ description: 'ID của suất chiếu' })
  @IsNumber()
  @IsNotEmpty()
  screening_id: number;

  @ApiProperty({ description: 'ID của ghế (tùy chọn)' })
  @IsOptional()
  @IsNumber()
  seat_id?: number;

  @ApiProperty({
    description: 'Danh sách đồ ăn/đồ uống (tùy chọn)',
    type: [FoodDrinkItem],
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FoodDrinkItem)
  food_drinks?: FoodDrinkItem[];

  @IsEnum(['booked', 'paid', 'cancelled'])
  @IsOptional()
  status?: 'booked' | 'paid' | 'cancelled';
}

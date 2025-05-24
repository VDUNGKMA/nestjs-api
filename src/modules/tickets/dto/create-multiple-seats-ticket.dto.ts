import { IsNumber, IsArray, ValidateNested, Min, IsOptional } from 'class-validator';
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

export class CreateMultipleSeatsTicketDto {
  @ApiProperty({ description: 'ID của suất chiếu' })
  @IsNumber()
  screening_id: number;

  @ApiProperty({ description: 'Danh sách ID của các ghế', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  seat_ids: number[];

  @ApiProperty({ 
    description: 'Danh sách giá của từng ghế (tùy chọn)', 
    type: [Number],
    required: false 
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  prices?: number[];

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
}

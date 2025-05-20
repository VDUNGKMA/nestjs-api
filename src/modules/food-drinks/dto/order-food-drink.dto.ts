import { IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class OrderItem {
  @ApiProperty({ description: 'ID of the food or drink item' })
  @IsNumber()
  food_drink_id: number;

  @ApiProperty({ description: 'Quantity of the item', example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class OrderFoodDrinkDto {
  @ApiProperty({ description: 'ID of the ticket associated with the order' })
  @IsNumber()
  ticket_id: number;

  @ApiProperty({
    description: 'Array of food/drink items to order',
    type: [OrderItem],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItem)
  items: OrderItem[];
}

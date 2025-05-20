import {
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFoodDrinkDto {
  @ApiProperty({ description: 'Name of the food or drink item' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Description of the food or drink item',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Price of the item', example: 50000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'URL to the image of the item', required: false })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiProperty({
    description: 'Category of the item',
    enum: ['food', 'drink', 'combo'],
    example: 'food',
  })
  @IsEnum(['food', 'drink', 'combo'])
  category: 'food' | 'drink' | 'combo';

  @ApiProperty({ description: 'Availability status', default: true })
  @IsBoolean()
  @IsOptional()
  is_available?: boolean = true;

  @ApiProperty({ description: 'Quantity in stock', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  stock_quantity?: number;
}

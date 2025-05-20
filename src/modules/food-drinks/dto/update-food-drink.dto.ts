import {
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFoodDrinkDto {
  @ApiPropertyOptional({ description: 'Name of the food or drink item' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Description of the food or drink item' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Price of the item', example: 50000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: 'URL to the image of the item' })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiPropertyOptional({
    description: 'Category of the item',
    enum: ['food', 'drink', 'combo'],
    example: 'food',
  })
  @IsEnum(['food', 'drink', 'combo'])
  @IsOptional()
  category?: 'food' | 'drink' | 'combo';

  @ApiPropertyOptional({ description: 'Availability status' })
  @IsBoolean()
  @IsOptional()
  is_available?: boolean;

  @ApiPropertyOptional({ description: 'Quantity in stock' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  stock_quantity?: number;
}

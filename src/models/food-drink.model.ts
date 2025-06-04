import { Table, Column, Model, DataType, HasMany } from 'sequelize-typescript';
import { BaseModel } from './base.model';

// Interface for FoodDrink attributes
export interface FoodDrinkAttributes {
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category: 'food' | 'drink' | 'combo';
  is_available: boolean;
  stock_quantity?: number;
}

@Table({
  tableName: 'FoodDrinks',
  timestamps: true,
})
export class FoodDrink
  extends BaseModel<FoodDrinkAttributes>
  implements FoodDrinkAttributes
{
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  price: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  image_url: string;

  @Column({
    type: DataType.ENUM('food', 'drink', 'combo'),
    allowNull: false,
    defaultValue: 'food',
  })
  category: 'food' | 'drink' | 'combo';

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  is_available: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  stock_quantity: number;
}

import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { BaseModel } from './base.model';
import { Ticket } from './ticket.model';
import { FoodDrink } from './food-drink.model';

// Interface for TicketFoodDrink attributes
export interface TicketFoodDrinkAttributes {
  ticket_id: number;
  food_drink_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'pending' | 'ready' | 'delivered' | 'cancelled';
}

@Table({
  tableName: 'TicketFoodDrinks',
  timestamps: true,
})
export class TicketFoodDrink
  extends BaseModel<TicketFoodDrinkAttributes>
  implements TicketFoodDrinkAttributes
{
  @ForeignKey(() => Ticket)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  ticket_id: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => FoodDrink)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  food_drink_id: number;

  @BelongsTo(() => FoodDrink)
  foodDrink: FoodDrink;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1,
  })
  quantity: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  unit_price: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  total_price: number;

  @Column({
    type: DataType.ENUM('pending', 'ready', 'delivered', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  })
  status: 'pending' | 'ready' | 'delivered' | 'cancelled';
}

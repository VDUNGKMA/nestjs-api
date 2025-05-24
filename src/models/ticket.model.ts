import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { User } from './user.model';
import { Screening } from './screening.model';
import { BaseModel } from './base.model';
import { TicketFoodDrink } from './ticket-food-drink.model';
import { TicketSeat } from './ticket-seat.model';

// Interface cho các thuộc tính của Ticket
export interface TicketAttributes {
  user_id: number;
  screening_id: number;
  booking_time?: Date; // Tùy chọn vì có giá trị mặc định
  status?: 'booked' | 'paid' | 'cancelled'; // Tùy chọn vì có giá trị mặc định
  total_price?: number; // Tổng giá của tất cả ghế
}

@Table({
  tableName: 'Tickets',
  timestamps: true,
  underscored: true,
})
export class Ticket
  extends BaseModel<TicketAttributes>
  implements TicketAttributes
{
  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  user_id: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Screening)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  screening_id: number;

  @BelongsTo(() => Screening)
  screening: Screening;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  booking_time: Date;

  @Column({
    type: DataType.ENUM('booked', 'paid', 'cancelled'),
    allowNull: false,
    defaultValue: 'booked',
  })
  status!: 'booked' | 'paid' | 'cancelled';

  // Thêm tổng giá tiền
  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  total_price?: number;

  // Relationship with TicketFoodDrink
  @HasMany(() => TicketFoodDrink)
  foodDrinks: TicketFoodDrink[];

  // Thêm quan hệ với TicketSeat
  @HasMany(() => TicketSeat)
  ticketSeats: TicketSeat[];
}

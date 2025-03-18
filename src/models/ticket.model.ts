import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from './user.model';
import { Screening } from './screening.model';
import { Seat } from './seat.model';
import { BaseModel } from './base.model';

// Interface cho các thuộc tính của Ticket
export interface TicketAttributes {
  user_id: number;
  screening_id: number;
  seat_id?: number; // Có thể null
  booking_time?: Date; // Tùy chọn vì có giá trị mặc định
  status?: 'booked' | 'paid' | 'cancelled'; // Tùy chọn vì có giá trị mặc định
}

@Table({
  tableName: 'Tickets',
  timestamps: true,
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

  @ForeignKey(() => Seat)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  seat_id: number;

  @BelongsTo(() => Seat)
  seat: Seat;

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
}

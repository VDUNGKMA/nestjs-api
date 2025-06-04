import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Ticket } from './ticket.model';
import { Seat } from './seat.model';
import { BaseModel } from './base.model';

export interface TicketSeatAttributes {
  ticket_id: number;
  seat_id: number;
  price?: number; // Giá riêng cho từng ghế (nếu cần)
}

@Table({
  tableName: 'TicketSeats',
  timestamps: true,
  underscored: true,
})
export class TicketSeat
  extends BaseModel<TicketSeatAttributes>
  implements TicketSeatAttributes
{
  @ForeignKey(() => Ticket)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  ticket_id: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => Seat)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  seat_id: number;

  @BelongsTo(() => Seat)
  seat: Seat;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  price?: number;
}

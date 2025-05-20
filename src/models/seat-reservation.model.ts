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
import { ReservationType } from '../modules/seat-reservations/dto/create-seat-reservation.dto';

export interface SeatReservationAttributes {
  user_id: number;
  screening_id: number;
  seat_id: number;
  expires_at: Date;
  reservation_type: ReservationType;
  reservation_id?: string;
}

@Table({
  tableName: 'SeatReservations',
  timestamps: true,
})
export class SeatReservation
  extends BaseModel<SeatReservationAttributes>
  implements SeatReservationAttributes
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
    allowNull: false,
  })
  seat_id: number;

  @BelongsTo(() => Seat)
  seat: Seat;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  expires_at: Date;

  @Column({
    type: DataType.ENUM('temporary', 'processing_payment'),
    allowNull: false,
    defaultValue: ReservationType.TEMPORARY,
  })
  reservation_type!: ReservationType;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  reservation_id?: string;
}

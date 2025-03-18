import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { TheaterRoom } from './theater-room.model';

interface SeatAttributes {
  theater_room_id: number;
  seat_row: string;
  seat_number: number;
  seat_type: 'regular' | 'vip' | 'deluxe';
  price: number;
}

@Table({
  tableName: 'Seats',
  timestamps: true,
})
export class Seat extends Model<Seat, SeatAttributes> {
  @ForeignKey(() => TheaterRoom)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  theater_room_id: number;

  @BelongsTo(() => TheaterRoom)
  theaterRoom: TheaterRoom;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  seat_row: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  seat_number: number;

  @Column({
    type: DataType.ENUM('regular', 'vip', 'deluxe'),
    allowNull: false,
    defaultValue: 'regular',
  })
  seat_type: 'regular' | 'vip' | 'deluxe';

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  price: number;
}

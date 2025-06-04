import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Theater } from './theater.model';
import { Screening } from './screening.model';
import { Seat } from './seat.model';

 interface ITheaterRoom {
  theater_id: number;
  room_name: string;
  seat_capacity: number;
}

@Table({
  tableName: 'TheaterRooms',
  timestamps: true,
})
export class TheaterRoom extends Model<TheaterRoom,ITheaterRoom > {
  @ForeignKey(() => Theater)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  theater_id: number;

  @BelongsTo(() => Theater)
  theater: Theater;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  room_name: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  seat_capacity: number;

  // Một phòng chiếu có nhiều suất chiếu
  @HasMany(() => Screening)
  screenings: Screening[];

  // Nếu quản lý chi tiết ghế
  @HasMany(() => Seat)
  seats: Seat[];
}

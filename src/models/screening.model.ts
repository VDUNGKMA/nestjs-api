
import {
  Model,
  Table,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Movie } from './movie.model';
import { TheaterRoom } from './theater-room.model';
import { Ticket } from './ticket.model';
import { BaseModel } from './base.model';

export interface ScreeningAttributes {
  movie_id: number;
  theater_room_id: number;
  start_time: Date;
  end_time: Date;
  price: number;
  // createdAt?: Date; // Tùy chọn, do Sequelize tự động thêm
  // updatedAt?: Date; // Tùy chọn, do Sequelize tự động thêm
}
@Table({
  tableName: 'Screenings',
  timestamps: true,
})
export class Screening
  extends BaseModel<ScreeningAttributes>
  implements ScreeningAttributes
{
  @ForeignKey(() => Movie)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  movie_id!: number;

  @BelongsTo(() => Movie)
  movie!: Movie;

  @ForeignKey(() => TheaterRoom)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  theater_room_id!: number;

  @BelongsTo(() => TheaterRoom)
  theaterRoom!: TheaterRoom;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  start_time!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  end_time!: Date;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  price!: number;

  @HasMany(() => Ticket)
  tickets!: Ticket[];
}
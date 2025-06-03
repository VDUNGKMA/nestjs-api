import { Table, Column, Model, DataType, HasMany } from 'sequelize-typescript';
import { TheaterRoom } from './theater-room.model';

interface TheaterCreationAttributes {
  name: string;
}

@Table({
  tableName: 'Theaters',
  timestamps: true,
})
export class Theater extends Model<Theater, TheaterCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  location: string;

  /**
   * Vĩ độ của rạp (dùng cho gợi ý theo vị trí địa lý)
   */
  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  latitude: number;

  /**
   * Kinh độ của rạp (dùng cho gợi ý theo vị trí địa lý)
   */
  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  longitude: number;

  // Một rạp có nhiều phòng chiếu
  @HasMany(() => TheaterRoom, 'theater_id')
  rooms: TheaterRoom[];
}

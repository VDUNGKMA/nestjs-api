import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  BelongsToMany,
} from 'sequelize-typescript';
import { Screening } from './screening.model';
import { Genre } from './genre.model';
import { MovieGenre } from './movie-genre.model';

export interface MovieCreationAttrs {
  title: string;
  description?: string;
  duration: number;
  release_date: Date;
  age_restriction?: number;
  director?: string;
  cast?: string; // Lưu dưới dạng chuỗi (TEXT)
  poster_url?: string;
  trailer_url?: string;
}

@Table({
  tableName: 'Movies',
  timestamps: true,
})
export class Movie extends Model<Movie, MovieCreationAttrs> {
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
  title: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  duration: number; // thời lượng phim (phút)

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
  })
  release_date: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  age_restriction: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  director: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  cast: string;
  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  poster_url: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  trailer_url: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  popularity: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  rating: number;

  // Quan hệ many-to-many với Genre qua bảng trung gian MovieGenre
  @BelongsToMany(() => Genre, () => MovieGenre)
  genres: Genre[];

  // Một phim có nhiều suất chiếu
  @HasMany(() => Screening)
  screenings: Screening[];
}

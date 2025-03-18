import {
  Table,
  Column,
  Model,
  DataType,
  BelongsToMany,
} from 'sequelize-typescript';
import { Movie } from './movie.model';
import { MovieGenre } from './movie-genre.model';

interface GenreCreationAttributes {
  name: string;
}
@Table({
  tableName: 'Genres',
  timestamps: false, // Nếu không cần createdAt, updatedAt
})
export class Genre extends Model<Genre, GenreCreationAttributes> {
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

  // Quan hệ many-to-many với Movie qua bảng trung gian MovieGenre
  @BelongsToMany(() => Movie, () => MovieGenre)
  movies: Movie[];
}

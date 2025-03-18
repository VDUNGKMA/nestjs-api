import { Table, Column, Model, ForeignKey, DataType } from 'sequelize-typescript';
import { Movie } from './movie.model';
import { Genre } from './genre.model';

@Table({
  tableName: 'MovieGenres',
  timestamps: false, // Nếu không cần timestamps
})
export class MovieGenre extends Model<MovieGenre> {
  @ForeignKey(() => Movie)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  movie_id: number;

  @ForeignKey(() => Genre)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  genre_id: number;
}

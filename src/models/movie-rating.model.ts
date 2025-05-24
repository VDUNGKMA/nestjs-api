import {
  Table,
  Column,
  Model,
  ForeignKey,
  DataType,
  BelongsTo,
  Unique,
} from 'sequelize-typescript';
import { Movie } from './movie.model';
import { User } from './user.model';

@Table({ tableName: 'MovieRatings', timestamps: true })
export class MovieRating extends Model {
  @ForeignKey(() => Movie)
  @Column(DataType.INTEGER)
  movie_id: number;

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  user_id: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  rating: number; // 1-5

  @Column({ type: DataType.STRING, allowNull: true })
  comment: string;

  @BelongsTo(() => Movie)
  movie: Movie;

  @BelongsTo(() => User)
  user: User;
}

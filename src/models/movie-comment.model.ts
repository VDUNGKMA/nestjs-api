import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Movie } from './movie.model';
import { User } from './user.model';

@Table({ tableName: 'MovieComments', timestamps: true, underscored: true })
export class MovieComment extends Model<MovieComment> {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  id: number;

  @ForeignKey(() => Movie)
  @Column({ type: DataType.INTEGER, allowNull: false })
  movie_id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  user_id: number;

  @Column({ type: DataType.TEXT, allowNull: false })
  content: string;

  @ForeignKey(() => MovieComment)
  @Column({ type: DataType.INTEGER, allowNull: true })
  parent_id: number;

  @BelongsTo(() => Movie)
  movie: Movie;

  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => MovieComment, { foreignKey: 'parent_id', as: 'parent' })
  parent: MovieComment;

  @HasMany(() => MovieComment, { foreignKey: 'parent_id', as: 'replies' })
  replies: MovieComment[];
}

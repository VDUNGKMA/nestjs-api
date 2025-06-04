import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Movie } from './movie.model';

/**
 * Mô hình lưu trữ độ tương đồng giữa các bộ phim
 * Được sử dụng bởi hệ thống gợi ý dựa trên nội dung (Content-based Filtering)
 */
@Table({
  tableName: 'MovieSimilarities',
  timestamps: true,
})
export class MovieSimilarity extends Model {
  @ForeignKey(() => Movie)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    primaryKey: true,
  })
  movie_id_1: number;

  @BelongsTo(() => Movie, { foreignKey: 'movie_id_1', as: 'movie1' })
  movie1: Movie;

  @ForeignKey(() => Movie)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    primaryKey: true,
  })
  movie_id_2: number;

  @BelongsTo(() => Movie, { foreignKey: 'movie_id_2', as: 'movie2' })
  movie2: Movie;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    defaultValue: 0,
  })
  similarity_score: number; // Điểm tương đồng giữa hai bộ phim (0-1)

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  similarity_features: any; // Chi tiết về các tính năng tương đồng (thể loại, đạo diễn, diễn viên, v.v.)

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'content-based',
  })
  similarity_type: string; // Loại tương đồng: 'content-based', 'collaborative', 'hybrid'

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  calculated_at: Date; // Thời điểm tính toán độ tương đồng
}
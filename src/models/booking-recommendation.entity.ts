import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from './user.model';
import { Movie } from './movie.model';

/**
 * Mô hình lưu trữ dữ liệu gợi ý phim cho người dùng
 * Được sử dụng bởi hệ thống gợi ý để lưu trữ kết quả gợi ý
 */
@Table({
  tableName: 'BookingRecommendations',
  timestamps: true,
})
export class BookingRecommendation extends Model {
  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  user_id: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Movie)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  movie_id: number;

  @BelongsTo(() => Movie)
  movie: Movie;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    defaultValue: 0,
  })
  score: number; // Điểm dự đoán mức độ phù hợp

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  recommendation_type: string; // 'content-based', 'collaborative', 'hybrid', 'context-aware'

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  context_data: any; // Dữ liệu ngữ cảnh khi đưa ra gợi ý (thời tiết, vị trí, thời gian, v.v.)

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  is_clicked: boolean; // Người dùng đã nhấp vào gợi ý chưa

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  is_booked: boolean; // Người dùng đã đặt vé cho phim được gợi ý chưa

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  clicked_at: Date; // Thời điểm người dùng nhấp vào gợi ý

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  booked_at: Date; // Thời điểm người dùng đặt vé cho phim được gợi ý
}
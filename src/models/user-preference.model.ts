import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from './user.model';

/**
 * Mô hình lưu trữ sở thích của người dùng
 * Được sử dụng bởi hệ thống gợi ý để cải thiện độ chính xác của các gợi ý
 */
@Table({
  tableName: 'UserPreferences',
  timestamps: true,
})
export class UserPreference extends Model {
  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    primaryKey: true,
  })
  user_id: number;

  @BelongsTo(() => User)
  user: User;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  favorite_genres: string[]; // Thể loại phim yêu thích

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  favorite_directors: string[]; // Đạo diễn yêu thích

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  favorite_actors: string[]; // Diễn viên yêu thích

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  preferred_screening_times: string[]; // Thời gian xem phim ưa thích

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  preferred_theaters: number[]; // ID của các rạp ưa thích

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  preferred_seat_types: string[]; // Loại ghế ưa thích

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  preferred_seat_rows: string[]; // Hàng ghế ưa thích

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  watch_history: number[]; // ID của các phim đã xem

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  search_history: string[]; // Lịch sử tìm kiếm

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  explicit_ratings: { [key: string]: number }; // Đánh giá rõ ràng của người dùng (movie_id: rating)

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  implicit_ratings: { [key: string]: number }; // Đánh giá ngầm định dựa trên hành vi (movie_id: score)

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  demographic_data: any; // Dữ liệu nhân khẩu học (tuổi, giới tính, v.v.)

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  last_updated: Date; // Thời điểm cập nhật cuối cùng

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  similar_users: { id: number; score: number }[]; // Danh sách user tương tự và điểm tương đồng
}

import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from './user.model';

@Table({
  tableName: 'Friendships',
  timestamps: true,
})
export class Friendship extends Model<Friendship> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  user_id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  friend_id: number;

  @Column({
    type: DataType.ENUM('pending', 'accepted', 'rejected', 'blocked'),
    allowNull: false,
    defaultValue: 'pending',
  })
  status: string;

  @BelongsTo(() => User, 'user_id')
  user: User;

  @BelongsTo(() => User, 'friend_id')
  friend: User;
}

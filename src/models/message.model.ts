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
  tableName: 'Messages',
  timestamps: true,
  underscored: true,
})
export class Message extends Model<Message> {
  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  sender_id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  receiver_id: number;

  @Column({ type: DataType.STRING, allowNull: false })
  content: string;

  @Column({ type: DataType.STRING, allowNull: true })
  imageUrl: string;

  @Column({ type: DataType.STRING, allowNull: true })
  fileUrl: string;

  @Column({ type: DataType.STRING, allowNull: true })
  fileName: string;

  @BelongsTo(() => User, 'sender_id')
  sender: User;

  @BelongsTo(() => User, 'receiver_id')
  receiver: User;
}

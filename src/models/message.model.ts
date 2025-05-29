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

  @Column({ type: DataType.STRING, allowNull: true, field: 'image_url' })
  imageUrl: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'file_url' })
  fileUrl: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'file_name' })
  fileName: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'reply_to_message_id',
  })
  replyToMessageId: number;

  @BelongsTo(() => User, 'sender_id')
  sender: User;

  @BelongsTo(() => User, 'receiver_id')
  receiver: User;
}

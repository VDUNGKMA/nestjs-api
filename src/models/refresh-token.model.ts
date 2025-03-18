import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from './user.model';


export interface RefreshTokenCreationAttrs {
  user_id: number;
  token: string;
  expiry_date: Date;
}

@Table({
  tableName: 'RefreshTokens',
  timestamps: true, // Nếu bạn muốn lưu createdAt và updatedAt
  underscored: true,
})
export class RefreshToken extends Model<RefreshToken,  RefreshTokenCreationAttrs> {
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
  token: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  expiry_date: Date;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  user_id: number;

  @BelongsTo(() => User)
  user: User;
}

import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Ticket } from './ticket.model';
import { User } from './user.model';
import { BaseModel } from './base.model';

export interface PaymentAttributes {
  ticket_id: number;
  user_id: number;
  amount: number;
  payment_status?: 'pending' | 'completed' | 'failed'; // Tùy chọn vì có giá trị mặc định
  transaction_id?: string; // Tùy chọn vì có thể null
  payment_method?: 'Momo' | 'Visa' | 'Cash';
}

@Table({
  tableName: 'Payments',
  timestamps: true,
})
export class Payment extends BaseModel<PaymentAttributes> {
  @ForeignKey(() => Ticket)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  ticket_id: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  user_id: number;

  @BelongsTo(() => User)
  user: User;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  amount: number;

  @Column({
    type: DataType.ENUM('pending', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
  })
  payment_status!: 'pending' | 'completed' | 'failed';

  @Column({
    type: DataType.STRING,
    unique: true,
    allowNull: true,
  })
  transaction_id: string;

  @Column({
    type: DataType.ENUM('Momo', 'Visa', 'Cash'),
    allowNull: true,
  })
  payment_method?: 'Momo' | 'Visa' | 'Cash';
}

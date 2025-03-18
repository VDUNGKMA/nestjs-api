import { Table, Column, Model, DataType, HasMany } from 'sequelize-typescript';
import { Ticket } from './ticket.model';
import { Payment } from './payment.model';

interface UserCreationAttrs {
  name: string;
  email: string;
  password: string;
  role?: string;
}

@Table({
  tableName: 'Users',
  timestamps: true,
})
export class User extends Model<User, UserCreationAttrs> {
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
  name: string;

  @Column({
    type: DataType.STRING,
    unique: true,
    allowNull: false,
  })
  email: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  password: string;

  @Column({
    type: DataType.ENUM('admin', 'staff', 'customer'),
    allowNull: false,
    defaultValue: 'customer',
  })
  role: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  image: string;

  // Một người dùng có thể có nhiều vé
  @HasMany(() => Ticket)
  tickets: Ticket[];

  // Một người dùng có thể có nhiều giao dịch thanh toán
  @HasMany(() => Payment)
  payments: Payment[];
}

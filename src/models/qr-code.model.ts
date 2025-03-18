import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Ticket } from './ticket.model';
import { BaseModel } from './base.model';

export interface QRCodeAttributes {
  ticket_id: number;
  qr_code: string;
}

@Table({
  tableName: 'QR_Codes',
  timestamps: false,
})
export class QR_Code extends BaseModel<QRCodeAttributes> {
  @ForeignKey(() => Ticket)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  ticket_id: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  qr_code: string;
}

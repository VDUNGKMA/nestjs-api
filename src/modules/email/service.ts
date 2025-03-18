// mail.service.ts
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()   
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {   
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async sendOtp(to: string, otp: string): Promise<void> {
    const mailOptions = {
      from: 'Booking Ticket Movie <Booing-Tikcet@app.com>',
      to,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}`,
    };

    await this.transporter.sendMail(mailOptions);
  }
}

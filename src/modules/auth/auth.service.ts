import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from '../email/service';
import { RefreshTokenService } from './refresh-token.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private readonly mailService: MailService,
    private refreshTokenService: RefreshTokenService,
  ) {}
  private otpStore: Map<string, { otp: string; expiry: Date }> = new Map(); // Lưu OTP và thời gian hết hạn
  private readonly otpExpiryTimeInMinutes = 2; // Thời gian hết hạn OTP (phút)
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (user && (await bcrypt.compare(pass, user.password))) {
      // Trả về dữ liệu user không bao gồm password
      const { password, ...result } = user.get();

      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role};
    const access_token = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });
    const refresh_token = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });
    // Tính toán ngày hết hạn cho refresh token, ví dụ 7 ngày sau thời điểm hiện tại
    const expiry_date = new Date();
    expiry_date.setDate(expiry_date.getDate() + 7);
    // Lưu refresh token vào DB
    await this.refreshTokenService.saveRefreshToken(
      user.id,
      refresh_token,
      expiry_date,
    );
    return { user, access_token, refresh_token };
  }

  async refreshToken(
    token: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      // Xác thực refresh token với secret refresh
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
      });
      // Kiểm tra xem refresh token có tồn tại trong DB hay không
      const storedToken = await this.refreshTokenService.findByToken(token);
      if (!storedToken) {
        throw new UnauthorizedException('Refresh token is not found');
      }

      const newPayload = {
        email: payload.email,
        sub: payload.sub,
        role: payload.role,
      };
      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      });
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      });
      const newExpiryDate = new Date();
      newExpiryDate.setDate(newExpiryDate.getDate() + 7);
      // Lưu refresh token mới vào DB
      await this.refreshTokenService.saveRefreshToken(
        newPayload.sub,
        newRefreshToken,
        newExpiryDate,
      );
      // Xóa refresh token cũ
      await this.refreshTokenService.deleteToken(token);
      return { access_token: newAccessToken, refresh_token: newRefreshToken };
    } catch (e) {
      throw new UnauthorizedException('Refresh token is invalid');
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const otp = this.generateOtp(); // Tạo mã OTP ngẫu nhiên
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + this.otpExpiryTimeInMinutes); // Đặt thời gian hết hạn

    this.otpStore.set(email, { otp, expiry }); // Lưu OTP và thời gian hết hạn

    await this.mailService.sendOtp(email, otp); // Gửi mã OTP qua email
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Tạo mã OTP ngẫu nhiên 6 chữ số
  }

  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const storedOtpData = this.otpStore.get(email);

    if (!storedOtpData) {
      return false; // OTP không tồn tại hoặc đã hết hạn
    }

    const { otp: storedOtp, expiry } = storedOtpData;
    if (new Date() > expiry) {
      this.otpStore.delete(email); // Xóa OTP hết hạn
      return false; // OTP đã hết hạn
    }

    if (storedOtp === otp) {
      this.otpStore.delete(email); // Xóa OTP sau khi xác minh
      return true;
    }

    return false; // OTP không hợp lệ
  }

  async resetPassword(email: string, newPassword: string): Promise<void> {
    // Tìm người dùng theo email
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    // Mã hóa mật khẩu mới trước khi lưu
    const hashedPassword = await this.usersService.hashPassword(newPassword);

    // Cập nhật mật khẩu trong cơ sở dữ liệu
    await this.usersService.updatePassword(user.id, hashedPassword);
  }

  async logout(user: any): Promise<{ message: string }> {
    // Xóa tất cả refresh token của user từ DB
    await this.refreshTokenService.deleteTokensByUser(user.userId);
    return { message: 'Logout successful' };
  }
}

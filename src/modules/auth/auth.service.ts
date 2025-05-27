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
import { OAuth2Client } from 'google-auth-library';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  private otpStore: Map<string, { otp: string; expiry: Date }> = new Map();
  private readonly otpExpiryTimeInMinutes = 2;
  private googleClient: OAuth2Client;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private readonly mailService: MailService,
    private refreshTokenService: RefreshTokenService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      // const { password, ...result } = user.get();
      // return result;
      return user;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
    };
    const access_token = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });
    const refresh_token = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });
    const expiry_date = new Date();
    expiry_date.setDate(expiry_date.getDate() + 7);
    await this.refreshTokenService.saveRefreshToken(
      user.id,
      refresh_token,
      expiry_date,
    );
    console.log('check user login', user);
    const { password, ...userSafe } = user.get ? user.get() : user;
    return { user: userSafe, access_token, refresh_token };
  }

  async validateGoogleMobile(idToken: string): Promise<any> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID, // Client ID từ Google Cloud Console
      });
      const payload = ticket.getPayload();

      if (!payload) {
        throw new UnauthorizedException('Invalid Google ID token: No payload');
      }

      const email = payload['email'];
      const displayName = payload['name'];
      const picture = payload['picture'];
      const emailVerified = payload['email_verified'];

      if (!email || !emailVerified) {
        throw new BadRequestException(
          'Google ID token missing email or not verified',
        );
      }

      let user = await this.usersService.findByEmail(email);
      if (!user) {
        const createUserDto: CreateUserDto = {
          name: displayName || 'Unknown',
          email,
          password: undefined,
          role: 'customer',
          image: picture,
        };
        user = await this.usersService.createUser(createUserDto);
      } else if (picture && !user.image) {
        await this.usersService.updateUser(user.id, { image: picture });
      }

      return { id: user.id, email: user.email, role: user.role };
    } catch (error) {
      throw new UnauthorizedException(
        `Invalid Google ID token: ${error.message}`,
      );
    }
  }
  async refreshToken(
    token: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
      });
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
      await this.refreshTokenService.saveRefreshToken(
        newPayload.sub,
        newRefreshToken,
        newExpiryDate,
      );
      await this.refreshTokenService.deleteToken(token);
      return { access_token: newAccessToken, refresh_token: newRefreshToken };
    } catch (e) {
      throw new UnauthorizedException('Refresh token is invalid');
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const otp = this.generateOtp();
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + this.otpExpiryTimeInMinutes);

    this.otpStore.set(email, { otp, expiry });
    await this.mailService.sendOtp(email, otp);
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const storedOtpData = this.otpStore.get(email);
    if (!storedOtpData) return false;

    const { otp: storedOtp, expiry } = storedOtpData;
    if (new Date() > expiry) {
      this.otpStore.delete(email);
      return false;
    }

    if (storedOtp === otp) {
      this.otpStore.delete(email);
      return true;
    }
    return false;
  }

  async resetPassword(email: string, newPassword: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const hashedPassword = await this.usersService.hashPassword(newPassword);
    await this.usersService.updatePassword(user.id, hashedPassword);
  }

  async logout(user: any): Promise<{ message: string }> {
    await this.refreshTokenService.deleteTokensByUser(user.userId);
    return { message: 'Logout successful' };
  }
}

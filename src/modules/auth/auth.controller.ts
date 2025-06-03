import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LocalAuthGuard } from './passport/local-auth.guard';
import { Public } from 'src/decorators/public-route.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/role.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    const userData = { ...createUserDto, role: 'customer' as const };
    return this.usersService.createUser(userData);
  }
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('register-staff')
  async register_staff(@Body() createUserDto: CreateUserDto) {
    const userData = { ...createUserDto, role: 'staff' as const };
    return this.usersService.createUser(userData);
  }
  @UseGuards(LocalAuthGuard)
  @Public()
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }
  @Public()
  @Post('google/mobile')
  async googleMobileLogin(@Body('idToken') idToken: string) {
    const user = await this.authService.validateGoogleMobile(idToken);
    return this.authService.login(user);
  }
  // Endpoint refresh token
  @Public()
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
  // Endpoint đăng xuất (protected: yêu cầu có access token)
  @Post('logout')
  async logout(@Request() req) {
    return this.authService.logout(req.user);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
  @UseGuards(RolesGuard)
  @Roles('customer')
  @Get('profile-cutomer')
  getProfilebyCustomer(@Request() req) {
    const { password, ...userProfile } = req.user;
    // console.log("check user profile",req.user)
    return userProfile
  }
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    await this.authService.forgotPassword(body.email);
    return { message: 'OTP sent to your email.' };
  }

  @Public()
  @Post('reset-password')
  async resetPassword(
    @Body() body: { email: string; otp: string; newPassword: string },
  ): Promise<any> {
    const { email, otp, newPassword } = body;

    const isOtpValid = await this.authService.verifyOtp(email, otp);

    if (!isOtpValid) {
      throw new BadRequestException('Invalid OTP.');
    }

    await this.authService.resetPassword(email, newPassword);

    return { message: 'Password reset successful.' };
  }
}

import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { LocalStrategy } from './passport/local.strategy';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './passport/jwt.strategy';
import { JwtAuthGuard } from './passport/jwt-auth.guard';
import { MailService } from '../email/service';
import { RefreshTokenService } from './refresh-token.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { RefreshToken } from 'src/models/refresh-token.model';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    PassportModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN },
    }),
    SequelizeModule.forFeature([RefreshToken]),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
    MailService,
    RefreshTokenService,
  ], // Add JwtAuthGuard to providers
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}

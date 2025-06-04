import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { RefreshToken } from '../../models/refresh-token.model';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectModel(RefreshToken)
    private refreshTokenModel: typeof RefreshToken,
  ) {}

  async saveRefreshToken(
    user_id: number,
    token: string,
    expiry_date: Date,
  ): Promise<RefreshToken> {
    return this.refreshTokenModel.create({ user_id, token, expiry_date });
  }

  async findByToken(token: string): Promise<RefreshToken> {
    const refreshToken = await this.refreshTokenModel.findOne({
      where: { token },
    });
    if (!refreshToken) {
      throw new Error('Refresh token not found');
    }
    return refreshToken;
  }

  async deleteToken(token: string): Promise<void> {
    await this.refreshTokenModel.destroy({ where: { token } });
  }

  async deleteTokensByUser(user_id: number): Promise<void> {
    await this.refreshTokenModel.destroy({ where: { user_id } });
  }
}

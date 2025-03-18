import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../../models/user.model';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Mutable } from '../../common/types/mutable';
import * as bcrypt from 'bcrypt';
import { Op } from 'sequelize';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private userModel: typeof User) {}

  IsEmailExist = async (email: string) => {
    const user = await this.userModel.findOne({ where: { email } });
    if (user) return true;
    return false;
  };

  hashPassword = async (password: string) => {
    return bcrypt.hash(password, 10);
  };
  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const IsEmailExist = this.IsEmailExist(createUserDto.email);
    if (await IsEmailExist) {
      throw new BadRequestException('Email is Exist');
    }
    const hashedPassword = await this.hashPassword(createUserDto.password);
    const role = createUserDto.role || 'customer';
    const data = {
      ...createUserDto,
      password: hashedPassword,
      role,
    };

    // Sử dụng build() để tạo instance đầy đủ
    const user = this.userModel.build(data);
    return user.save();
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userModel.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findAll(): Promise<User[]> {
    return this.userModel.findAll();
  }
  // Trong UsersService
  async findAllByPaginate(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ users: User[]; total: number }> {
    const offset = (page - 1) * limit;
    const { rows, count } = await this.userModel.findAndCountAll({
      offset,
      limit,
    });
    return { users: rows, total: count };
  }
  async findOne(id: number): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
  async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    // Tạo một đối tượng mới dựa trên updateUserDto
    const updateData: Mutable<UpdateUserDto> = { ...updateUserDto };

    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    await user.update(updateData);
    return user;
  }
  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    // Logic để cập nhật mật khẩu
    const user = await this.userModel.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.password = hashedPassword;
    await user.save();
  }
  async deleteUser(id: number): Promise<void> {
    const user = await this.findOne(id);
    await user.destroy();
  }
  async findById(id: number): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
  async findAllByRole(role: string): Promise<User[]> {
    return this.userModel.findAll({
      where: { role }, // Lọc theo role
    });
  }
}

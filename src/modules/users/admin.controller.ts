import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from 'src/decorators/role.decorator';
import { User } from 'src/models/user.model';
import { RolesGuard } from 'src/guards/roles.guard';

@UseGuards(RolesGuard)
@Roles('admin')
@Controller('admin/users')
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  // Tạo người dùng mới (cho phép admin tạo nhân viên hoặc khách hàng)
  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.createUser(createUserDto);
  }

  // Lấy danh sách tất cả người dùng, có thể thêm query parameter để lọc theo role
  @Get('user-by-role')
  async findAllByRole(@Query('role') role?: string): Promise<User[]> {
    if (role) {
      return this.usersService.findAllByRole(role);
    }
    return this.usersService.findAll();
  }
  // Lấy danh sách tất cả người dùng
  @Get('user')
  async findAll(
    @Query('page') page: string, 
    @Query('limit') limit: string
  ): Promise<{ users: User[]; total: number }> {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    return this.usersService.findAllByPaginate(pageNum, limitNum);
  }
  @Get('statistics')
  async getUserStatistics() {
    return this.usersService.getUserStatistics();
  }
  // Lấy thông tin chi tiết của người dùng theo ID
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    return this.usersService.findOne(Number(id));
  }

  // Cập nhật thông tin người dùng theo ID
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateUser(Number(id), updateUserDto);
  }

  // Xóa người dùng theo ID
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.usersService.deleteUser(Number(id));
  }

  // Tìm kiếm người dùng theo email
  @Get('search/:email')
  async findByEmail(@Param('email') email: string): Promise<User> {
    return this.usersService.findByEmail(email);
  }
}

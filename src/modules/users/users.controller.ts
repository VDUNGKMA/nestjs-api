import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '../../models/user.model';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Request() req): Promise<User> {
    return this.usersService.findOne(req.user.userId);
  }

  @Put('profile')
  async updateProfile(
    @Request() req,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateUser(req.user.userId, updateUserDto);
  }

  // Thêm endpoint để upload ảnh
  @Post('profile/upload-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads', // Thư mục lưu file
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const fileExt = extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${fileExt}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Chỉ cho phép các định dạng ảnh
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
          return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn kích thước file (5MB)
    }),
  )
  async uploadImage(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<User> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const updateUserDto: UpdateUserDto = {
      image: file.path, // Lưu đường dẫn file vào database
    };

    return this.usersService.updateUser(req.user.userId, updateUserDto);
  }
}

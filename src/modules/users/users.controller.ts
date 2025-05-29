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
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '../../models/user.model';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import * as path from 'path';
import { ChatGateway } from './chat.gateway';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly chatGateway: ChatGateway,
  ) {}

  // ...
  @Get('profile')
  async getProfile(@Request() req): Promise<UserProfileDto> {
    const user = await this.usersService.findOne(req.user.userId);
    const { password, ...userProfile } = user.get(); // Exclude password
    return userProfile as UserProfileDto; // Cast to UserProfileDto
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

  @Put(':id/change-password')
  async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const { oldPassword, newPassword } = changePasswordDto;
    await this.usersService.changePassword(id, oldPassword, newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async searchUsers(@Query('query') query: string, @Req() req) {
    const myId = req.user.userId;
    // console.log('MY ID:', myId);
    return this.usersService.searchUsers(query, myId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('friends/request')
  async sendFriendRequest(@Request() req, @Body('friendId') friendId: number) {
    const request = await this.usersService.sendFriendRequest(
      req.user.userId,
      friendId,
    );
    // Gửi notify realtime, không throw nếu lỗi
    try {
      const sender = await this.usersService.findOne(req.user.userId);
      await this.chatGateway.notifyFriendRequest(friendId, sender);
    } catch (e) {
      console.warn('Không gửi được notify realtime:', e);
    }
    return request;
  }

  @UseGuards(JwtAuthGuard)
  @Post('friends/accept')
  async acceptFriendRequest(
    @Request() req,
    @Body('friendId') friendId: number,
  ) {
    const friendship = await this.usersService.acceptFriendRequest(
      req.user.userId,
      friendId,
    );
    // Gửi notify realtime, không throw nếu lỗi
    try {
      const receiver = await this.usersService.findOne(req.user.userId);
      await this.chatGateway.notifyFriendAccepted(friendId, receiver);
    } catch (e) {
      console.warn('Không gửi được notify realtime:', e);
    }
    return friendship;
  }

  @UseGuards(JwtAuthGuard)
  @Post('friends/reject')
  async rejectFriendRequest(
    @Request() req,
    @Body('friendId') friendId: number,
  ) {
    return this.usersService.rejectFriendRequest(req.user.userId, friendId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('friends')
  async getFriends(@Request() req) {
    return this.usersService.getFriends(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('friends/pending')
  async getPendingRequests(@Request() req) {
    return this.usersService.getPendingRequests(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('messages/send')
  async sendMessage(
    @Request() req,
    @Body('receiverId') receiverId: number,
    @Body('content') content: string,
  ) {
    return this.usersService.sendMessage(req.user.userId, receiverId, content);
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages/history/:friendId')
  async getChatHistory(@Request() req, @Param('friendId') friendId: string) {
    const fid = parseInt(friendId, 10);
    if (isNaN(fid)) {
      throw new BadRequestException('Invalid friendId');
    }
    return this.usersService.getChatHistory(req.user.userId, fid);
  }

  @UseGuards(JwtAuthGuard)
  @Post('fcm-token')
  async saveFcmToken(@Request() req, @Body('fcmToken') fcmToken: string) {
    return this.usersService.saveFcmToken(req.user.userId, fcmToken);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          const name = path.basename(file.originalname, ext);
          cb(null, `${name}-${Date.now()}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = [
          '.png',
          '.jpg',
          '.jpeg',
          '.gif',
          '.pdf',
          '.docx',
          '.zip',
        ];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else
          cb(new Error('Only image, pdf, docx, zip files are allowed'), false);
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req) {
    if (!file) throw new Error('No file uploaded');
    const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    return { url, fileName: file.originalname };
  }
}

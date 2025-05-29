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
import { Friendship } from '../../models/friendship.model';
import { Message } from '../../models/message.model';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private userModel: typeof User,
    @InjectModel(Message) private messageModel: typeof Message,
  ) {}

  IsEmailExist = async (email: string) => {
    const user = await this.userModel.findOne({ where: { email } });
    if (user) return true;
    return false;
  };

  hashPassword = async (password: string) => {
    return bcrypt.hash(password, 10);
  };

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const isEmailExist = await this.IsEmailExist(createUserDto.email);
    if (isEmailExist) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = createUserDto.password
      ? await this.hashPassword(createUserDto.password)
      : '';
    const role = createUserDto.role || 'customer';
    const data = {
      ...createUserDto,
      password: hashedPassword,
      role,
    };

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
  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userModel.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Old password is incorrect');
    }

    // Mã hóa mật khẩu mới và cập nhật
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
  }
  async getUserStatistics(): Promise<{
    totalUsers: number;
    totalAdmins: number;
    totalCustomers: number;
    totalStaff: number;
  }> {
    // Đếm tổng số người dùng
    const totalUsers = await this.userModel.count();

    // Đếm số lượng admin
    const totalAdmins = await this.userModel.count({
      where: { role: 'admin' },
    });

    // Đếm số lượng khách hàng
    const totalCustomers = await this.userModel.count({
      where: { role: 'customer' },
    });

    // Đếm số lượng nhân viên
    const totalStaff = await this.userModel.count({
      where: { role: 'staff' },
    });

    return {
      totalUsers,
      totalAdmins,
      totalCustomers,
      totalStaff,
    };
  }
  async searchUsers(query: string, myId: number) {
    console.log('SEARCH QUERY:', query, 'MY ID:', myId);
    const result = await this.userModel.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.ne]: myId } },
          { role: 'customer' },
          {
            [Op.or]: [
              { name: { [Op.iLike]: `%${query}%` } },
              { phone: { [Op.iLike]: `%${query}%` } },
            ],
          },
        ],
      },
      attributes: ['id', 'name', 'phone', 'image'],
    });
    console.log('SEARCH RESULT:', result);
    return result;
  }

  // Gửi lời mời kết bạn
  async sendFriendRequest(userId: number, friendId: number) {
    const existing = await Friendship.findOne({
      where: {
        user_id: userId,
        friend_id: friendId,
      },
    });
    if (existing)
      throw new BadRequestException('Friend request already sent or exists');
    const request = await Friendship.create({
      user_id: userId,
      friend_id: friendId,
      status: 'pending',
    } as any);
    return request;
  }

  // Chấp nhận lời mời kết bạn
  async acceptFriendRequest(userId: number, friendId: number) {
    const friendship = await Friendship.findOne({
      where: { user_id: friendId, friend_id: userId, status: 'pending' },
    });
    if (!friendship) throw new NotFoundException('No pending friend request');
    friendship.status = 'accepted';
    await friendship.save();
    await Friendship.create({
      user_id: userId,
      friend_id: friendId,
      status: 'accepted',
    } as any);
    return friendship;
  }

  // Từ chối lời mời kết bạn
  async rejectFriendRequest(userId: number, friendId: number) {
    const friendship = await Friendship.findOne({
      where: { user_id: friendId, friend_id: userId, status: 'pending' },
    });
    if (!friendship) throw new NotFoundException('No pending friend request');
    friendship.status = 'rejected';
    await friendship.save();
    return friendship;
  }

  // Lấy danh sách bạn bè
  async getFriends(userId: number) {
    const friends = await Friendship.findAll({
      where: { user_id: userId, status: 'accepted' },
      include: [
        {
          model: User,
          as: 'friend',
          attributes: ['id', 'name', 'phone', 'image'],
        },
      ],
    });
    return friends.map((f) => f.friend);
  }

  // Lấy danh sách lời mời kết bạn đang chờ xử lý
  async getPendingRequests(userId: number) {
    return Friendship.findAll({
      where: { friend_id: userId, status: 'pending' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'phone', 'image'],
        },
      ],
    });
  }

  // Kiểm tra 2 user có phải bạn bè không
  async areFriends(userId: number, friendId: number) {
    const f1 = await Friendship.findOne({
      where: { user_id: userId, friend_id: friendId, status: 'accepted' },
    });
    const f2 = await Friendship.findOne({
      where: { user_id: friendId, friend_id: userId, status: 'accepted' },
    });
    return !!(f1 && f2);
  }

  // Gửi tin nhắn (chỉ cho phép bạn bè)
  async sendMessage(
    senderId: number,
    receiverId: number,
    content: string,
    replyToMessageId?: number,
  ) {
    if (!(await this.areFriends(senderId, receiverId))) {
      throw new BadRequestException('You can only message your friends');
    }
    const message = await Message.create({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      replyToMessageId,
    } as any);
    let replyToMessage: any = null;
    if (replyToMessageId) {
      const found = await Message.findByPk(replyToMessageId, {
        include: [{ model: User, as: 'sender', attributes: ['id', 'image'] }],
      });
      replyToMessage = found ? found.toJSON() : null;
      if (replyToMessage && replyToMessage.sender) {
        replyToMessage.avatar = replyToMessage.sender.image;
      }
    }
    // Lấy lại message kèm sender
    const msgWithSender = await Message.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'image'] }],
    });
    const msgJson = msgWithSender ? msgWithSender.toJSON() : message.toJSON();
    return { ...msgJson, avatar: msgJson.sender?.image, replyToMessage };
  }

  // Lấy lịch sử chat giữa 2 user (chỉ cho phép bạn bè)
  async getChatHistory(userId: number, friendId: number) {
    if (!(await this.areFriends(userId, friendId))) {
      throw new BadRequestException('You can only view chat with your friends');
    }
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId, receiver_id: friendId },
          { sender_id: friendId, receiver_id: userId },
        ],
      },
      order: [['created_at', 'ASC']],
      include: [{ model: User, as: 'sender', attributes: ['id', 'image'] }],
    });
    return messages.map((msg) => {
      const m = msg.toJSON();
      return { ...m, avatar: m.sender?.image };
    });
  }

  async saveFcmToken(userId: number, fcmToken: string) {
    const user = await this.userModel.findByPk(userId);
    if (!user) throw new NotFoundException('User not found');
    user.fcm_token = fcmToken;
    await user.save();
    return { success: true };
  }

  async getUserById(id: number) {
    return this.userModel.findByPk(id);
  }

  async sendImageMessage(
    senderId: number,
    receiverId: number,
    imageUrl: string,
    content: string,
  ) {
    return await this.messageModel.create({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      imageUrl,
    } as any);
  }

  async sendFileMessage(
    senderId: number,
    receiverId: number,
    fileUrl: string,
    fileName: string,
    content: string,
  ) {
    return await this.messageModel.create({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      fileUrl,
      fileName,
    } as any);
  }
}

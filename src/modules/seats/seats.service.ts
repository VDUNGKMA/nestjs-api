// src/seats/seat.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Seat } from '../../models/seat.model';
import { CreateSeatDto } from './dto/create-seat.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { TheaterRoom } from 'src/models/theater-room.model';

@Injectable()
export class SeatService {
  constructor(
    @InjectModel(Seat)
    private seatModel: typeof Seat,

    @InjectModel(TheaterRoom)
    private theaterRoomModel: typeof TheaterRoom,
  ) {}

  /** Tạo một ghế mới */
  async createSeat(createSeatDto: CreateSeatDto): Promise<Seat> {

   const theaterRoom = await this.theaterRoomModel.findOne({
     where: { id: createSeatDto.theater_room_id },
   });
   if (!theaterRoom) {
     throw new NotFoundException(
       `No screening room found with id ${createSeatDto.theater_room_id}`,
     );
   }
    return this.seatModel.create(createSeatDto);
  }

  /** Lấy tất cả ghế, có thể lọc theo theater_room_id */
  async findAll(theaterRoomId?: number): Promise<Seat[]> {
    if (theaterRoomId) {
      return this.seatModel.findAll({
        where: { theater_room_id: theaterRoomId },
      });
    }
    return this.seatModel.findAll();
  }

  /** Lấy thông tin một ghế theo ID */
  async findOne(id: number): Promise<Seat> {
    const seat = await this.seatModel.findByPk(id);
    if (!seat) {
      throw new NotFoundException(`No Seat found with id ${id}`);
    }
    return seat;
  }

  /** Cập nhật thông tin ghế */
  async update(id: number, updateSeatDto: UpdateSeatDto): Promise<Seat> {
    const seat = await this.findOne(id); // Ném lỗi nếu không tìm thấy
    await seat.update(updateSeatDto);
    return seat;
  }

  /** Xóa một ghế */
  async remove(id: number): Promise<void> {
    const seat = await this.findOne(id); // Ném lỗi nếu không tìm thấy
    await seat.destroy();
  }
}

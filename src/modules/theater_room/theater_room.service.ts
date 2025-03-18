import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TheaterRoom } from '../../models/theater-room.model';
import { CreateTheaterRoomDto } from './dto/theater-room.dto';
import { Theater } from 'src/models/theater.model';

@Injectable()
export class TheaterRoomService {
  constructor(
    @InjectModel(TheaterRoom)
    private readonly theaterRoomModel: typeof TheaterRoom,
    @InjectModel(Theater)
    private readonly theaterModel: typeof Theater,
    
  ) {}

  async create(
    createTheaterRoomDto: CreateTheaterRoomDto,
  ): Promise<TheaterRoom> {
     const theater = await this.theaterModel.findByPk(
       createTheaterRoomDto.theater_id,
     );
     if (!theater) {
       throw new BadRequestException(
         `Theater with id ${createTheaterRoomDto.theater_id} does not exist.`,
       );
     }
    const theaterRoom = this.theaterRoomModel.build(createTheaterRoomDto);
    return theaterRoom.save();
  }

  async findAll(): Promise<TheaterRoom[]> {
    return this.theaterRoomModel.findAll({ include: { all: true } });
  }

  async findOne(id: number): Promise<TheaterRoom> {
    const theaterRoom = await this.theaterRoomModel.findByPk(id, {
      include: { all: true },
    });
    if (!theaterRoom) {
      throw new NotFoundException(`TheaterRoom with ID ${id} not found`);
    }
    return theaterRoom;
  }

  async update(
    id: number,
    updateData: Partial<CreateTheaterRoomDto>,
  ): Promise<TheaterRoom> {
    const theaterRoom = await this.findOne(id);
    return theaterRoom.update(updateData);
  }

  async remove(id: number): Promise<void> {
    const theaterRoom = await this.findOne(id);
    await theaterRoom.destroy();
  }
}

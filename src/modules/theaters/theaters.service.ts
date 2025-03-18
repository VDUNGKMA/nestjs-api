import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Theater } from 'src/models/theater.model';
import { CreateTheaterDto} from './dto/create-theater.dto';
import { UpdateTheaterDto } from './dto/update-theater.dto';
import { TheaterRoom } from 'src/models/theater-room.model';

@Injectable()
export class TheatersService {
  constructor(@InjectModel(Theater) private theaterModel: typeof Theater) {}

  async create(createTheaterDto: CreateTheaterDto): Promise<Theater> {
    return this.theaterModel.create(createTheaterDto);
  }

  async findAll(): Promise<Theater[]> {
    return this.theaterModel.findAll({
      include: [
        {
          model: TheaterRoom,
          as: 'rooms', // Alias phải khớp với định nghĩa trong model Theater
        },
      ],
    });
  }

  async findOne(id: number): Promise<Theater> {
    const theater = await this.theaterModel.findByPk(id);
    if (!theater) {
      throw new NotFoundException(`Theater with ID ${id} not found`);
    }
    return theater;
  }

  async update(
    id: number,
    updateTheaterDto: UpdateTheaterDto,
  ): Promise<Theater> {
    const theater = await this.findOne(id);
    await theater.update(updateTheaterDto);
    return theater;
  }

  async remove(id: number): Promise<void> {
    const theater = await this.findOne(id);
    await theater.destroy();
  }
}

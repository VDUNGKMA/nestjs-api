// src/screenings/screening.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Screening, ScreeningAttributes } from '../../models/screening.model';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { UpdateScreeningDto } from './dto/update-screening.dto';
import { Movie } from '../../models/movie.model';
import { TheaterRoom } from '../../models/theater-room.model';

@Injectable()
export class ScreeningService {
  constructor(
    @InjectModel(Screening) private screeningModel: typeof Screening,
    @InjectModel(Movie) private movieModel: typeof Movie,
    @InjectModel(TheaterRoom) private theaterRoomModel: typeof TheaterRoom,
  ) {}

  //   // Tạo suất chiếu mới
  //   async create(createScreeningDto: CreateScreeningDto): Promise<Screening> {
  //     const movie = await this.movieModel.findByPk(createScreeningDto.movie_id);
  //     if (!movie) {
  //       throw new NotFoundException(
  //         `Không tìm thấy phim với id ${createScreeningDto.movie_id}`,
  //       );
  //     }

  //     const theaterRoom = await this.theaterRoomModel.findByPk(
  //       createScreeningDto.theater_room_id,
  //     );
  //     if (!theaterRoom) {
  //       throw new NotFoundException(
  //         `Không tìm thấy phòng chiếu với id ${createScreeningDto.theater_room_id}`,
  //       );
  //     }

  //     const screeningData = {
  //       ...createScreeningDto,
  //       start_time: new Date(createScreeningDto.start_time),
  //       end_time: new Date(createScreeningDto.end_time),
  //     };

  //     return this.screeningModel.create(screeningData);
  //   }
  async create(createScreeningDto: CreateScreeningDto): Promise<Screening> {
    const movie = await this.movieModel.findByPk(createScreeningDto.movie_id);
    if (!movie) {
      throw new NotFoundException(
        `Không tìm thấy phim với id ${createScreeningDto.movie_id}`,
      );
    }

    const theaterRoom = await this.theaterRoomModel.findByPk(
      createScreeningDto.theater_room_id,
    );
    if (!theaterRoom) {
      throw new NotFoundException(
        `Không tìm thấy phòng chiếu với id ${createScreeningDto.theater_room_id}`,
      );
    }

    const screeningData: ScreeningAttributes = {
      movie_id: createScreeningDto.movie_id,
      theater_room_id: createScreeningDto.theater_room_id,
      start_time: createScreeningDto.start_time,
      end_time: createScreeningDto.end_time,
      price: createScreeningDto.price,
    };

    return this.screeningModel.create(screeningData);
  }
  // Lấy tất cả suất chiếu
  async findAll(): Promise<Screening[]> {
    return this.screeningModel.findAll();
  }

  // Lấy một suất chiếu theo ID
  async findOne(id: number): Promise<Screening> {
    const screening = await this.screeningModel.findByPk(id);
    if (!screening) {
      throw new NotFoundException(`Không tìm thấy suất chiếu với id ${id}`);
    }
    return screening;
  }

  // Cập nhật suất chiếu
  async update(
    id: number,
    updateScreeningDto: UpdateScreeningDto,
  ): Promise<Screening> {
    const screening = await this.findOne(id);

    if (updateScreeningDto.movie_id) {
      const movie = await this.movieModel.findByPk(updateScreeningDto.movie_id);
      if (!movie) {
        throw new NotFoundException(
          `Không tìm thấy phim với id ${updateScreeningDto.movie_id}`,
        );
      }
    }

    if (updateScreeningDto.theater_room_id) {
      const theaterRoom = await this.theaterRoomModel.findByPk(
        updateScreeningDto.theater_room_id,
      );
      if (!theaterRoom) {
        throw new NotFoundException(
          `Không tìm thấy phòng chiếu với id ${updateScreeningDto.theater_room_id}`,
        );
      }
    }

    await screening.update(updateScreeningDto);
    return screening;
  }

  // Xóa suất chiếu
  async remove(id: number): Promise<void> {
    const screening = await this.findOne(id);
    await screening.destroy();
  }
}

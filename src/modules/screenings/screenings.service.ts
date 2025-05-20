// src/screenings/screening.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Screening, ScreeningAttributes } from '../../models/screening.model';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { UpdateScreeningDto } from './dto/update-screening.dto';
import { Movie } from '../../models/movie.model';
import { TheaterRoom } from '../../models/theater-room.model';
import { Op } from 'sequelize';
import { Theater } from '../../models/theater.model';
@Injectable()
export class ScreeningService {
  constructor(
    @InjectModel(Screening) private screeningModel: typeof Screening,
    @InjectModel(Movie) private movieModel: typeof Movie,
    @InjectModel(TheaterRoom) private theaterRoomModel: typeof TheaterRoom,
  ) {}

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
  // // Lấy tất cả suất chiếu
  // async findAll(): Promise<Screening[]> {
  //   return this.screeningModel.findAll();
  // }

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
  async findAll(filters: {
    date?: string;
    theaterId?: number;
    theaterRoomId?: number;
    movieId?: number;
  }) {
    const where: any = {};

    // Lọc theo ngày (giả sử trường ngày là start_time)
    if (filters.date) {
      where.start_time = {
        [Op.gte]: new Date(`${filters.date}T00:00:00`),
        [Op.lt]: new Date(`${filters.date}T23:59:59`),
      };
    }

    // Lọc theo movieId
    if (filters.movieId) {
      where.movie_id = filters.movieId;
    }

    // Lọc theo phòng chiếu
    if (filters.theaterRoomId) {
      where.theater_room_id = filters.theaterRoomId;
    }

    // Thêm điều kiện lọc ra những suất chiếu chưa kết thúc
    const currentTime = new Date();
    where.end_time = {
      [Op.gt]: currentTime,
    };

    // Lọc theo rạp (theaterId) thông qua liên kết phòng chiếu, và include cả Theater để lấy tên rạp
    let include: any[] = [];
    if (filters.theaterId) {
      include.push({
        model: TheaterRoom,
        where: { theater_id: filters.theaterId },
        include: [{ model: Theater }],
      });
    } else {
      include.push({
        model: TheaterRoom,
        include: [{ model: Theater }],
      });
    }

    return this.screeningModel.findAll({
      where,
      include,
      order: [['start_time', 'ASC']],
    });
  }
}

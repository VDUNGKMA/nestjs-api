import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Movie } from '../../models/movie.model';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Genre } from '../../models/genre.model';
import { MovieGenre } from '../../models/movie-genre.model';
import { Attributes } from 'sequelize';
import { Op } from 'sequelize';
import { Screening } from '../../models/screening.model';
import * as fs from 'fs';
import * as path from 'path';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class MoviesService {
  constructor(
    @InjectModel(Movie) private movieModel: typeof Movie,
    @InjectModel(MovieGenre) private movieGenreModel: typeof MovieGenre,
    @InjectModel(Genre) private genreModel: typeof Genre,
    @InjectModel(Screening) private screeningModel: typeof Screening,
    private sequelize: Sequelize,
  ) {}

  async createMovie(createMovieDto: CreateMovieDto): Promise<Movie> {
    const { genreIds, ...movieData } = createMovieDto;
    const data = {
      ...movieData,
      cast: movieData.cast ? movieData.cast.join(', ') : movieData.cast,
    };

    // Tạo phim
    const movie = await this.movieModel.create(data);
    // Liên kết với các thể loại nếu có genreIds
    if (genreIds && genreIds.length > 0) {
      const movieGenres = genreIds.map((genreId) => ({
        movie_id: movie.id,
        genre_id: genreId,
      }));

      await this.movieGenreModel.bulkCreate(movieGenres as MovieGenre[]);
    }
    const result = await this.findOne(movie.id);
    return result;
  }

  async findAll(filter: any): Promise<Movie[]> {
    const where: any = {};

    if (filter.popular) {
      where.popularity = {
        [Op.and]: [{ [Op.ne]: null }, { [Op.gt]: 50 }],
      };
    }
    if (filter.upcoming) {
      where.release_date = { [Op.gt]: new Date() };
    }
    if (filter.nowPlaying) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      where.release_date = {
        [Op.lte]: today,
      };

      // Thêm điều kiện để kiểm tra xem phim có suất chiếu trong ngày hôm nay không
      where['$screenings.start_time$'] = {
        [Op.between]: [today, tomorrow],
      };
    }
    if (filter.topRated) {
      where.rating = {
        [Op.and]: [{ [Op.ne]: null }, { [Op.gt]: 8 }],
      };
    }

    return this.movieModel.findAll({
      where,
      include: [
        {
          model: Genre,
          through: { attributes: [] },
          as: 'genres',
        },
        {
          model: Screening,
          as: 'screenings',
          where: filter.nowPlaying
            ? {
                start_time: {
                  [Op.between]: [
                    new Date(),
                    new Date(new Date().setDate(new Date().getDate() + 1)),
                  ],
                },
              }
            : undefined,
          required: filter.nowPlaying,
        },
      ],
    });
  }

  async findOne(id: number): Promise<Movie> {
    const movie = await this.movieModel.findByPk(id, {
      include: [
        {
          model: Genre,
          through: { attributes: [] },
          as: 'genres',
        },
      ],
    });
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }
    return movie;
  }

  async updateMovie(
    id: number,
    updateMovieDto: UpdateMovieDto,
  ): Promise<Movie> {
    const movie = await this.findOne(id);
    const { genreIds, ...movieData } = updateMovieDto;

    // Cập nhật thông tin phim
    if (movieData.cast && Array.isArray(movieData.cast)) {
      movieData.cast = movieData.cast.join(', ');
    }
    await movie.update(movieData as any);

    // Cập nhật thể loại nếu có genreIds
    if (genreIds !== undefined) {
      await this.movieGenreModel.destroy({ where: { movie_id: id } });
      if (genreIds.length > 0) {
        const movieGenres = genreIds.map((genreId) => ({
          movie_id: id,
          genre_id: genreId,
        }));
        await this.movieGenreModel.bulkCreate(movieGenres as MovieGenre[]);
      }
    }

    return this.findOne(id);
  }

  async deleteMovie(id: number): Promise<void> {
    const movie = await this.findOne(id);
    await this.movieGenreModel.destroy({ where: { movie_id: id } });
    await movie.destroy();
  }

  // Phương thức mới để cập nhật poster của phim
  async updateMoviePoster(
    id: number,
    file: Express.Multer.File,
  ): Promise<Movie> {
    const movie = await this.findOne(id);
    
    // Xóa poster cũ nếu có
    if (movie.poster_url && !movie.poster_url.startsWith('http')) {
      const oldPosterPath = path.join(process.cwd(), movie.poster_url);
      if (fs.existsSync(oldPosterPath)) {
        fs.unlinkSync(oldPosterPath);
      }
    }
    
    // Cập nhật đường dẫn poster mới
    const posterUrl = `/uploads/posters/${file.filename}`;
    await movie.update({ poster_url: posterUrl });
    
    return this.findOne(id);
  }

  // Phương thức mới để cập nhật trailer của phim
  async updateMovieTrailer(
    id: number,
    file: Express.Multer.File,
  ): Promise<Movie> {
    const movie = await this.findOne(id);
    
    // Xóa trailer cũ nếu có
    if (movie.trailer_url && !movie.trailer_url.startsWith('http')) {
      const oldTrailerPath = path.join(process.cwd(), movie.trailer_url);
      if (fs.existsSync(oldTrailerPath)) {
        fs.unlinkSync(oldTrailerPath);
      }
    }
    
    // Cập nhật đường dẫn trailer mới
    const trailerUrl = `/uploads/trailers/${file.filename}`;
    await movie.update({ trailer_url: trailerUrl });
    
    return this.findOne(id);
  }

  // Phương thức mới để tính tổng số phim, thể loại phim và số suất chiếu
  async getStatistics() {
    // Sử dụng transaction để đảm bảo tính nhất quán của dữ liệu
    const result = await this.sequelize.transaction(async (t) => {
      // Đếm tổng số phim
      const totalMovies = await this.movieModel.count({
        transaction: t,
      });

      // Đếm tổng số thể loại phim
      const totalGenres = await this.genreModel.count({
        transaction: t,
      });

      // Đếm tổng số suất chiếu
      const totalScreenings = await this.screeningModel.count({
        transaction: t,
      });

      // Đếm số suất chiếu trong ngày hôm nay
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayScreenings = await this.screeningModel.count({
        where: {
          start_time: {
            [Op.between]: [today, tomorrow],
          },
        },
        transaction: t,
      });

      // Đếm số suất chiếu trong tuần này
      const startOfWeek = new Date();
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Đặt về Chủ Nhật
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7); // Đến hết Thứ Bảy

      const thisWeekScreenings = await this.screeningModel.count({
        where: {
          start_time: {
            [Op.between]: [startOfWeek, endOfWeek],
          },
        },
        transaction: t,
      });

      // Đếm số phim đang chiếu (có suất chiếu trong ngày hôm nay)
      const nowPlayingMovies = await this.movieModel.count({
        include: [
          {
            model: Screening,
            as: 'screenings',
            where: {
              start_time: {
                [Op.between]: [today, tomorrow],
              },
            },
            required: true,
          },
        ],
        transaction: t,
      });

      // Đếm số phim sắp chiếu (ngày phát hành trong tương lai)
      const upcomingMovies = await this.movieModel.count({
        where: {
          release_date: {
            [Op.gt]: today,
          },
        },
        transaction: t,
      });

      return {
        totalMovies,
        totalGenres,
        totalScreenings,
        todayScreenings,
        thisWeekScreenings,
        nowPlayingMovies,
        upcomingMovies,
      };
    });

    return result;
  }
}

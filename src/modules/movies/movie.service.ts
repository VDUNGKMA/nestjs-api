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

@Injectable()
export class MoviesService {
  constructor(
    @InjectModel(Movie) private movieModel: typeof Movie,
    @InjectModel(MovieGenre) private movieGenreModel: typeof MovieGenre,
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
}

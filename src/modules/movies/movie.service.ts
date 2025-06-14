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
import { MovieRating } from '../../models/movie-rating.model';
import { DataCollectionService } from '../recommendation/services/data-collection.service';

@Injectable()
export class MoviesService {
  constructor(
    @InjectModel(Movie) private movieModel: typeof Movie,
    @InjectModel(MovieGenre) private movieGenreModel: typeof MovieGenre,
    @InjectModel(Genre) private genreModel: typeof Genre,
    @InjectModel(Screening) private screeningModel: typeof Screening,
    private sequelize: Sequelize,
    private readonly dataCollectionService: DataCollectionService,
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

    // Khởi tạo biến ngày đầu hôm nay và đầu ngày mai
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Khởi tạo thời điểm hiện tại để check suất chiếu đang diễn ra
    const now = new Date();

    // Ngày kết thúc cho việc lọc phim đang chiếu (mặc định 14 ngày từ hiện tại)
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    if (filter.popular) {
      where.popularity = {
        [Op.and]: [{ [Op.ne]: null }, { [Op.gt]: 50 }],
      };
    }
    if (filter.upcoming) {
      where.release_date = { [Op.gt]: new Date() };
    }
    if (filter.nowPlaying) {
      // Phim đang chiếu là phim đã phát hành
      where.release_date = { [Op.lte]: today };
      // Không yêu cầu phải có suất chiếu trong ngày hôm nay
    }
    if (filter.currentlyShowing) {
      // Phim đang chiếu hiện tại - phim có suất chiếu đang diễn ra
      where.release_date = { [Op.lte]: now };
      // Sẽ lọc thông qua điều kiện screening ở include
    }
    if (filter.topRated) {
      where.rating = {
        [Op.and]: [{ [Op.ne]: null }, { [Op.gt]: 8 }],
      };
    }

    // Log điều kiện where để debug nếu cần
    // console.log('today:', today);
    // console.log('tomorrow:', tomorrow);
    // console.log('where:', where);

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
          where: filter.currentlyShowing
            ? {
                // Suất chiếu trong 14 ngày tới
                start_time: {
                  [Op.gt]: now,
                  [Op.lt]: endDate,
                },
              }
            : undefined,
          required: filter.currentlyShowing,
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

  /**
   * Lấy danh sách phim đang chiếu với nhiều tiêu chí
   * - Bao gồm phim đã phát hành
   * - Có lịch chiếu trong 14 ngày tới
   */
  async getShowingMovies(days: number = 14): Promise<Movie[]> {
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + days);

    return this.movieModel.findAll({
      where: {
        // Phim đã phát hành
        release_date: { [Op.lte]: now },
      },
      include: [
        {
          model: Genre,
          through: { attributes: [] },
          as: 'genres',
        },
        {
          model: Screening,
          where: {
            // Có lịch chiếu từ hiện tại đến X ngày sau
            start_time: {
              [Op.gte]: now,
              [Op.lt]: endDate,
            },
          },
          required: true, // Bắt buộc phải có suất chiếu
        },
      ],
      order: [['release_date', 'DESC']], // Sắp xếp theo ngày phát hành
      group: ['Movie.id'], // Nhóm theo ID phim để tránh trùng lặp
    });
  }

  async updateMovieAverageRating(movieId: number) {
    const { average } = await this.getAverageRating(movieId);
    // console.log(
    //   'Cập nhật rating trung bình:',
    //   average,
    //   'cho movieId:',
    //   movieId,
    // );
    const [affectedRows] = await this.movieModel.update(
      { rating: average },
      { where: { id: movieId } },
    );
    console.log('Số dòng bị ảnh hưởng:', affectedRows);
  }

  async updateMoviePopularity(movieId: number) {
    const { average, count: ratingsCount } =
      await this.getAverageRating(movieId);
    // Lấy tất cả screening của phim này
    const screenings = await this.screeningModel.findAll({
      where: { movie_id: movieId },
    });
    const screeningIds = screenings.map((s) => s.id);
    let ticketsCount = 0;
    if (screeningIds.length > 0 && this.sequelize.models.Ticket) {
      ticketsCount = await this.sequelize.models.Ticket.count({
        where: { screening_id: screeningIds },
      });
    }
    const popularity = ratingsCount * 2 + average * 10 + ticketsCount * 1;
    await this.movieModel.update({ popularity }, { where: { id: movieId } });
  }

  async rateMovie(
    movieId: number,
    userId: number,
    rating: number,
    comment?: string,
  ) {
    if (!movieId || !userId || !rating) {
      throw new Error('Thiếu thông tin đánh giá');
    }
    if (rating < 1 || rating > 5) {
      throw new Error('Số sao phải từ 1 đến 5');
    }
    // Tìm hoặc tạo mới đánh giá
    const [movieRating, created] = await MovieRating.findOrCreate({
      where: { movie_id: movieId, user_id: userId },
      defaults: { rating, comment },
    });
    if (!created) {
      // Nếu đã có, cập nhật lại rating/comment
      movieRating.rating = rating;
      if (comment !== undefined) movieRating.comment = comment;
      await movieRating.save();
    }
    // Cập nhật điểm trung bình vào Movie
    await this.updateMovieAverageRating(movieId);
    // Cập nhật popularity vào Movie
    await this.updateMoviePopularity(movieId);
    // Đồng bộ preferences tự động sau khi đánh giá
    await this.dataCollectionService.collectRatingData();
    return { success: true, rating: movieRating };
  }

  async getAverageRating(movieId: number) {
    const ratings = await MovieRating.findAll({ where: { movie_id: movieId } });
    if (ratings.length === 0) return { average: 0, count: 0 };
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const avg = sum / ratings.length;
    return { average: Number(avg.toFixed(2)), count: ratings.length };
  }

  async getRatings(movieId: number) {
    const ratings = await MovieRating.findAll({
      where: { movie_id: movieId },
      include: ['user'],
      order: [['createdAt', 'DESC']],
    });
    return ratings;
  }

  async getTopRatedMovies(
    minRating: number = 4,
    limit: number = 10,
  ): Promise<Movie[]> {
    return this.movieModel.findAll({
      where: {
        rating: { [Op.gte]: minRating },
      },
      order: [['rating', 'DESC']],
      limit,
      include: [
        {
          model: Genre,
          through: { attributes: [] },
          as: 'genres',
        },
      ],
    });
  }

  async getTopPopularMovies(
    minPopularity: number = 45,
    limit: number = 10,
  ): Promise<Movie[]> {
    return this.movieModel.findAll({
      where: {
        popularity: { [Op.gte]: minPopularity },
      },
      order: [['popularity', 'DESC']],
      limit,
      include: [
        {
          model: Genre,
          through: { attributes: [] },
          as: 'genres',
        },
      ],
    });
  }
}

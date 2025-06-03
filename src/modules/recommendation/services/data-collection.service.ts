import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { Cron, CronExpression } from '@nestjs/schedule';

// Models
import { Movie } from '../../../models/movie.model';
import { User } from '../../../models/user.model';
import { Ticket } from '../../../models/ticket.model';
import { MovieRating } from '../../../models/movie-rating.model';
import { UserPreference } from '../../../models/user-preference.model';
import { BookingRecommendation } from '../../../models/booking-recommendation.entity';

@Injectable()
export class DataCollectionService {
  private readonly logger = new Logger(DataCollectionService.name);

  constructor(
    @InjectModel(Movie)
    private movieModel: typeof Movie,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Ticket)
    private ticketModel: typeof Ticket,
    @InjectModel(MovieRating)
    private movieRatingModel: typeof MovieRating,
    @InjectModel(UserPreference)
    private userPreferenceModel: typeof UserPreference,
    @InjectModel(BookingRecommendation)
    private bookingRecommendationModel: typeof BookingRecommendation,
    private readonly sequelize: Sequelize,
  ) {}

  /**
   * Thu thập dữ liệu về lịch sử xem phim của người dùng
   * Chạy hàng ngày vào lúc 3 giờ sáng
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async collectWatchHistory() {
    try {
      this.logger.log('Collecting watch history data...');

      // Lấy tất cả người dùng
      const users = await this.userModel.findAll();

      // Tạo transaction
      const transaction = await this.sequelize.transaction();

      try {
        for (const user of users) {
          // Lấy danh sách vé đã đặt
          const tickets = await this.ticketModel.findAll({
            where: {
              user_id: user.id,
              status: 'completed', // Chỉ lấy các vé đã hoàn thành
            },
            include: [{ association: 'screening' }],
            transaction,
          });

          // Lấy danh sách ID của các phim đã xem
          const watchedMovieIds: Set<number> = new Set();
          tickets.forEach((ticket) => {
            const movieId = ticket.screening?.movie_id;
            if (movieId) {
              watchedMovieIds.add(movieId);
            }
          });

          // Tìm hoặc tạo mới bản ghi UserPreference
          const [userPreference, created] =
            await this.userPreferenceModel.findOrCreate({
              where: { user_id: user.id },
              defaults: {
                user_id: user.id,
                watch_history: Array.from(watchedMovieIds),
                last_updated: new Date(),
              },
              transaction,
            });

          // Nếu đã tồn tại, cập nhật lịch sử xem phim
          if (!created) {
            await userPreference.update(
              {
                watch_history: Array.from(watchedMovieIds),
                last_updated: new Date(),
              },
              { transaction },
            );
          }
        }

        // Commit transaction
        await transaction.commit();

        this.logger.log(`Collected watch history for ${users.length} users`);
      } catch (error) {
        // Rollback transaction nếu có lỗi
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error collecting watch history: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Thu thập dữ liệu về đánh giá phim của người dùng
   * Chạy hàng ngày vào lúc 4 giờ sáng
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async collectRatingData() {
    try {
      this.logger.log('Collecting rating data...');

      // Lấy tất cả người dùng
      const users = await this.userModel.findAll();

      // Tạo transaction
      const transaction = await this.sequelize.transaction();

      try {
        for (const user of users) {
          // Lấy danh sách đánh giá rõ ràng
          const ratings = await this.movieRatingModel.findAll({
            where: { user_id: user.id },
            transaction,
          });

          // Tạo map đánh giá
          const explicitRatings: Record<number, number> = {};
          ratings.forEach((rating) => {
            explicitRatings[rating.movie_id] = rating.rating;
          });

          // Tìm hoặc tạo mới bản ghi UserPreference
          const [userPreference, created] =
            await this.userPreferenceModel.findOrCreate({
              where: { user_id: user.id },
              defaults: {
                user_id: user.id,
                explicit_ratings: explicitRatings,
                last_updated: new Date(),
              },
              transaction,
            });

          // Nếu đã tồn tại, cập nhật đánh giá
          if (!created) {
            await userPreference.update(
              {
                explicit_ratings: explicitRatings,
                last_updated: new Date(),
              },
              { transaction },
            );
          }
        }

        // Commit transaction
        await transaction.commit();

        this.logger.log(`Collected rating data for ${users.length} users`);
      } catch (error) {
        // Rollback transaction nếu có lỗi
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error collecting rating data: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Thu thập dữ liệu về sở thích của người dùng
   * Chạy hàng tuần vào lúc 2 giờ sáng thứ Hai
   */
  @Cron(CronExpression.EVERY_WEEK)
  async collectUserPreferences() {
    try {
      this.logger.log('Collecting user preferences...');

      // Lấy tất cả người dùng
      const users = await this.userModel.findAll();

      // Tạo transaction
      const transaction = await this.sequelize.transaction();

      try {
        for (const user of users) {
          // Lấy danh sách vé đã đặt
          const tickets = await this.ticketModel.findAll({
            where: {
              user_id: user.id,
              status: 'completed',
            },
            include: [
              {
                association: 'screening',
                include: [
                  {
                    association: 'movie',
                    include: [{ association: 'genres' }],
                  },
                  { association: 'theaterRoom' },
                ],
              },
              {
                association: 'ticketSeats',
                include: [{ association: 'seat' }],
              },
            ],
            transaction,
          });

          // Tính toán thể loại yêu thích
          const genreCounts = new Map();
          // Tính toán đạo diễn yêu thích
          const directorCounts = new Map();
          // Tính toán diễn viên yêu thích
          const actorCounts = new Map();
          // Tính toán thời gian xem phim ưa thích
          const timeCounts = new Map();
          // Tính toán rạp ưa thích
          const theaterCounts = new Map();
          // Tính toán loại ghế ưa thích
          const seatTypeCounts = new Map();
          // Tính toán hàng ghế ưa thích
          const seatRowCounts = new Map();

          tickets.forEach((ticket) => {
            const movie = ticket.screening?.movie;
            const theaterRoom = ticket.screening?.theaterRoom;
            const startTime = ticket.screening?.start_time;
            const ticketSeats = ticket.ticketSeats || [];

            // Thống kê thể loại
            if (movie && movie.genres) {
              movie.genres.forEach((genre) => {
                const count = genreCounts.get(genre.name) || 0;
                genreCounts.set(genre.name, count + 1);
              });
            }

            // Thống kê đạo diễn
            if (movie && movie.director) {
              const count = directorCounts.get(movie.director) || 0;
              directorCounts.set(movie.director, count + 1);
            }

            // Thống kê diễn viên
            if (movie && movie.cast) {
              const actors = movie.cast.split(',').map((actor) => actor.trim());
              actors.forEach((actor) => {
                const count = actorCounts.get(actor) || 0;
                actorCounts.set(actor, count + 1);
              });
            }

            // Thống kê thời gian
            if (startTime) {
              const hour = startTime.getHours();
              let timeSlot;

              if (hour >= 9 && hour < 12) {
                timeSlot = 'morning';
              } else if (hour >= 12 && hour < 17) {
                timeSlot = 'afternoon';
              } else if (hour >= 17 && hour < 22) {
                timeSlot = 'evening';
              } else {
                timeSlot = 'night';
              }

              const count = timeCounts.get(timeSlot) || 0;
              timeCounts.set(timeSlot, count + 1);
            }

            // Thống kê rạp
            if (theaterRoom) {
              const theaterId = theaterRoom.theater_id;
              if (theaterId) {
                const count = theaterCounts.get(theaterId) || 0;
                theaterCounts.set(theaterId, count + 1);
              }
            }

            // Thống kê loại ghế và hàng ghế
            ticketSeats.forEach((ticketSeat) => {
              const seatType = ticketSeat.seat?.seat_type;
              const seatRow = ticketSeat.seat?.seat_row;
              if (seatType) {
                const count = seatTypeCounts.get(seatType) || 0;
                seatTypeCounts.set(seatType, count + 1);
              }
              if (seatRow) {
                const count = seatRowCounts.get(seatRow) || 0;
                seatRowCounts.set(seatRow, count + 1);
              }
            });
          });

          // Sắp xếp và lấy các giá trị phổ biến nhất
          const favoriteGenres = Array.from(genreCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map((entry) => entry[0]);

          const favoriteDirectors = Array.from(directorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map((entry) => entry[0]);

          const favoriteActors = Array.from(actorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map((entry) => entry[0]);

          const preferredScreeningTimes = Array.from(timeCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map((entry) => entry[0]);

          const preferredTheaters = Array.from(theaterCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map((entry) => entry[0]);

          const preferredSeatTypes = Array.from(seatTypeCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map((entry) => entry[0]);

          const preferredSeatRows = Array.from(seatRowCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map((entry) => entry[0]);

          // Tìm hoặc tạo mới bản ghi UserPreference
          const [userPreference, created] =
            await this.userPreferenceModel.findOrCreate({
              where: { user_id: user.id },
              defaults: {
                user_id: user.id,
                favorite_genres: favoriteGenres,
                favorite_directors: favoriteDirectors,
                favorite_actors: favoriteActors,
                preferred_screening_times: preferredScreeningTimes,
                preferred_theaters: preferredTheaters,
                preferred_seat_types: preferredSeatTypes,
                preferred_seat_rows: preferredSeatRows,
                last_updated: new Date(),
              },
              transaction,
            });

          // Nếu đã tồn tại, cập nhật sở thích
          if (!created) {
            await userPreference.update(
              {
                favorite_genres: favoriteGenres,
                favorite_directors: favoriteDirectors,
                favorite_actors: favoriteActors,
                preferred_screening_times: preferredScreeningTimes,
                preferred_theaters: preferredTheaters,
                preferred_seat_types: preferredSeatTypes,
                preferred_seat_rows: preferredSeatRows,
                last_updated: new Date(),
              },
              { transaction },
            );
          }
        }

        // Commit transaction
        await transaction.commit();

        this.logger.log(`Collected preferences for ${users.length} users`);
      } catch (error) {
        // Rollback transaction nếu có lỗi
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error collecting user preferences: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Thu thập dữ liệu về phản hồi gợi ý
   * Chạy hàng ngày vào lúc 5 giờ sáng
   */
  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async collectRecommendationFeedback() {
    try {
      this.logger.log('Collecting recommendation feedback...');

      // Lấy tất cả người dùng
      const users = await this.userModel.findAll();

      // Tạo transaction
      const transaction = await this.sequelize.transaction();

      try {
        for (const user of users) {
          // Lấy danh sách gợi ý đã được nhấp hoặc đặt vé
          const recommendations = await this.bookingRecommendationModel.findAll(
            {
              where: {
                user_id: user.id,
                [Op.or]: [{ is_clicked: true }, { is_booked: true }],
              },
              transaction,
            },
          );

          // Tạo map đánh giá ngầm định
          const implicitRatings = {};

          recommendations.forEach((rec) => {
            // Nếu đã đặt vé, đánh giá cao hơn
            if (rec.is_booked) {
              implicitRatings[rec.movie_id] = 4.5;
            }
            // Nếu chỉ nhấp vào, đánh giá thấp hơn
            else if (rec.is_clicked) {
              implicitRatings[rec.movie_id] = 3.5;
            }
          });

          // Tìm hoặc tạo mới bản ghi UserPreference
          const [userPreference, created] =
            await this.userPreferenceModel.findOrCreate({
              where: { user_id: user.id },
              defaults: {
                user_id: user.id,
                implicit_ratings: implicitRatings,
                last_updated: new Date(),
              },
              transaction,
            });

          // Nếu đã tồn tại, cập nhật đánh giá ngầm định
          if (!created) {
            await userPreference.update(
              {
                implicit_ratings: implicitRatings,
                last_updated: new Date(),
              },
              { transaction },
            );
          }
        }

        // Commit transaction
        await transaction.commit();

        this.logger.log(
          `Collected recommendation feedback for ${users.length} users`,
        );
      } catch (error) {
        // Rollback transaction nếu có lỗi
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error collecting recommendation feedback: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Cập nhật độ phổ biến của phim
   * Chạy hàng ngày vào lúc 1 giờ sáng
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async updateMoviePopularity() {
    try {
      this.logger.log('Updating movie popularity...');

      // Lấy tất cả các phim
      const movies = await this.movieModel.findAll();

      // Tạo transaction
      const transaction = await this.sequelize.transaction();

      try {
        for (const movie of movies) {
          // Lấy số lượng vé đã đặt trong 7 ngày qua
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const ticketCount = await this.ticketModel.count({
            where: {
              status: 'completed',
              booking_time: {
                [Op.gte]: sevenDaysAgo,
              },
            },
            include: [
              {
                association: 'screening',
                where: {
                  movie_id: movie.id,
                },
                required: true,
              },
            ],
            transaction,
          });

          // Lấy số lượng đánh giá
          const ratingCount = await this.movieRatingModel.count({
            where: {
              movie_id: movie.id,
            },
            transaction,
          });

          // Lấy điểm đánh giá trung bình
          const ratings = await this.movieRatingModel.findAll({
            where: {
              movie_id: movie.id,
            },
            transaction,
          });

          let avgRating = 0;
          if (ratings.length > 0) {
            const totalRating = ratings.reduce(
              (sum, rating) => sum + rating.rating,
              0,
            );
            avgRating = totalRating / ratings.length;
          }

          // Tính độ phổ biến dựa trên số lượng vé, số lượng đánh giá và điểm đánh giá
          const popularity =
            ticketCount * 0.6 + ratingCount * 0.2 + avgRating * 0.2;

          // Cập nhật độ phổ biến và điểm đánh giá
          await movie.update(
            {
              popularity,
              rating: avgRating,
            },
            { transaction },
          );
        }

        // Commit transaction
        await transaction.commit();

        this.logger.log(`Updated popularity for ${movies.length} movies`);
      } catch (error) {
        // Rollback transaction nếu có lỗi
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error updating movie popularity: ${error.message}`,
        error.stack,
      );
    }
  }
}

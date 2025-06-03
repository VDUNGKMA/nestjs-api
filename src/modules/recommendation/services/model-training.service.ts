import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

// Models
import { Movie } from '../../../models/movie.model';
import { User } from '../../../models/user.model';
import { MovieRating } from '../../../models/movie-rating.model';
import { UserPreference } from '../../../models/user-preference.model';
import { MovieSimilarity } from '../../../models/movie-similarity.model';

// Khai báo interface cho các object dùng trong map/filter
interface SimilarityRecord {
  movie_id_1: number;
  movie_id_2: number;
  similarity_score: number;
  features: string;
}

@Injectable()
export class ModelTrainingService {
  private readonly logger = new Logger(ModelTrainingService.name);

  constructor(
    @InjectModel(Movie)
    private movieModel: typeof Movie,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(MovieRating)
    private movieRatingModel: typeof MovieRating,
    @InjectModel(UserPreference)
    private userPreferenceModel: typeof UserPreference,
    @InjectModel(MovieSimilarity)
    private movieSimilarityModel: typeof MovieSimilarity,
    @InjectQueue('recommendation')
    private recommendationQueue: Queue,
    private readonly sequelize: Sequelize,
  ) {}

  /**
   * Huấn luyện mô hình tương đồng phim dựa trên nội dung
   * Chạy hàng tuần vào lúc 2 giờ sáng thứ Ba
   */
  @Cron('0 2 * * 2') // Mỗi thứ Ba lúc 2 giờ sáng
  async trainContentBasedModel() {
    try {
      this.logger.log('Training content-based model...');

      // Lấy tất cả phim
      const movies = await this.movieModel.findAll({
        include: [{ association: 'genres' }],
      });

      // Tạo transaction
      const transaction = await this.sequelize.transaction();

      try {
        // Xóa tất cả bản ghi tương đồng cũ
        await this.movieSimilarityModel.destroy({
          where: {},
          truncate: true,
          transaction,
        });

        // Tính toán tương đồng giữa các cặp phim
        const similarityRecords: any[] = [];

        for (let i = 0; i < movies.length; i++) {
          const movieA = movies[i];

          for (let j = i + 1; j < movies.length; j++) {
            const movieB = movies[j];

            // Tính điểm tương đồng dựa trên thể loại
            const genreSimilarity = this.calculateGenreSimilarity(
              movieA,
              movieB,
            );

            // Tính điểm tương đồng dựa trên đạo diễn
            const directorSimilarity = this.calculateDirectorSimilarity(
              movieA,
              movieB,
            );

            // Tính điểm tương đồng dựa trên diễn viên
            const castSimilarity = this.calculateCastSimilarity(movieA, movieB);

            // Tính điểm tương đồng tổng hợp
            const similarityScore =
              genreSimilarity * 0.5 +
              directorSimilarity * 0.3 +
              castSimilarity * 0.2;

            // Chỉ lưu các cặp có điểm tương đồng > 0
            if (similarityScore > 0) {
              similarityRecords.push({
                movie_id_1: movieA.id,
                movie_id_2: movieB.id,
                similarity_score: similarityScore,
                features: JSON.stringify({
                  genre_similarity: genreSimilarity,
                  director_similarity: directorSimilarity,
                  cast_similarity: castSimilarity,
                }),
              });

              // Lưu cả chiều ngược lại
              similarityRecords.push({
                movie_id_1: movieB.id,
                movie_id_2: movieA.id,
                similarity_score: similarityScore,
                features: JSON.stringify({
                  genre_similarity: genreSimilarity,
                  director_similarity: directorSimilarity,
                  cast_similarity: castSimilarity,
                }),
              });
            }
          }
        }

        // Lưu các bản ghi tương đồng
        if (similarityRecords.length > 0) {
          await this.movieSimilarityModel.bulkCreate(
            similarityRecords as any[],
            { transaction },
          );
        }

        // Commit transaction
        await transaction.commit();

        this.logger.log(
          `Trained content-based model with ${similarityRecords.length / 2} movie pairs`,
        );
      } catch (error) {
        // Rollback transaction nếu có lỗi
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error training content-based model: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Huấn luyện mô hình lọc cộng tác
   * Chạy hàng tuần vào lúc 3 giờ sáng thứ Tư
   */
  @Cron('0 3 * * 3') // Mỗi thứ Tư lúc 3 giờ sáng
  async trainCollaborativeFilteringModel() {
    try {
      this.logger.log('Training collaborative filtering model...');
      // Lấy tất cả user có role là 'customer'
      const users = await this.userModel.findAll({
        where: { role: 'customer' },
      });
      for (const user of users) {
        await this.recommendationQueue.add(
          'train-collaborative-model',
          { userId: user.id },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 60000, // 1 phút
            },
          },
        );
      }
      this.logger.log('Added collaborative filtering training job(s) to queue');
    } catch (error) {
      this.logger.error(
        `Error queueing collaborative filtering model training: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Huấn luyện mô hình Wide & Deep
   * Chạy hàng tháng vào lúc 1 giờ sáng ngày đầu tiên của tháng
   */
  @Cron('0 1 1 * *') // Ngày 1 hàng tháng lúc 1 giờ sáng
  async trainWideAndDeepModel() {
    try {
      this.logger.log('Training Wide & Deep model...');
      // Lấy tất cả user có role là 'customer'
      const users = await this.userModel.findAll({
        where: { role: 'customer' },
      });
      for (const user of users) {
        await this.recommendationQueue.add(
          'train-widedeep-model',
          { userId: user.id },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 120000, // 2 phút
            },
          },
        );
      }
      this.logger.log('Added Wide & Deep model training job(s) to queue');
    } catch (error) {
      this.logger.error(
        `Error queueing Wide & Deep model training: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Tính toán điểm tương đồng dựa trên thể loại
   */
  private calculateGenreSimilarity(movieA: Movie, movieB: Movie): number {
    if (!movieA.genres || !movieB.genres) {
      return 0;
    }

    const genresA = new Set(movieA.genres.map((genre) => genre.id));
    const genresB = new Set(movieB.genres.map((genre) => genre.id));

    // Tính số lượng thể loại chung
    let commonGenres = 0;
    genresA.forEach((genreId) => {
      if (genresB.has(genreId)) {
        commonGenres++;
      }
    });

    // Tính hệ số Jaccard
    const unionSize = genresA.size + genresB.size - commonGenres;
    return unionSize > 0 ? commonGenres / unionSize : 0;
  }

  /**
   * Tính toán điểm tương đồng dựa trên đạo diễn
   */
  private calculateDirectorSimilarity(movieA: Movie, movieB: Movie): number {
    if (!movieA.director || !movieB.director) {
      return 0;
    }

    return movieA.director === movieB.director ? 1 : 0;
  }

  /**
   * Tính toán điểm tương đồng dựa trên diễn viên
   */
  private calculateCastSimilarity(movieA: Movie, movieB: Movie): number {
    if (!movieA.cast || !movieB.cast) {
      return 0;
    }

    const castA = new Set(movieA.cast.split(',').map((actor) => actor.trim()));
    const castB = new Set(movieB.cast.split(',').map((actor) => actor.trim()));

    // Tính số lượng diễn viên chung
    let commonCast = 0;
    castA.forEach((actor) => {
      if (castB.has(actor)) {
        commonCast++;
      }
    });

    // Tính hệ số Jaccard
    const unionSize = castA.size + castB.size - commonCast;
    return unionSize > 0 ? commonCast / unionSize : 0;
  }

  /**
   * Tạo ma trận đánh giá người dùng-phim
   */
  async createUserMovieRatingMatrix() {
    try {
      // Lấy tất cả người dùng
      const users = await this.userModel.findAll();

      // Lấy tất cả phim
      const movies = await this.movieModel.findAll();

      // Lấy tất cả đánh giá
      const ratings = await this.movieRatingModel.findAll();

      // Tạo ma trận đánh giá
      const ratingMatrix = {};

      // Khởi tạo ma trận trống
      users.forEach((user) => {
        ratingMatrix[user.id] = {};
        movies.forEach((movie) => {
          ratingMatrix[user.id][movie.id] = 0;
        });
      });

      // Điền đánh giá vào ma trận
      ratings.forEach((rating) => {
        if (
          ratingMatrix[rating.user_id] &&
          ratingMatrix[rating.user_id][rating.movie_id] !== undefined
        ) {
          ratingMatrix[rating.user_id][rating.movie_id] = rating.rating;
        }
      });

      return ratingMatrix;
    } catch (error) {
      this.logger.error(
        `Error creating user-movie rating matrix: ${error.message}`,
        error.stack,
      );
      return {};
    }
  }

  /**
   * Tính toán tương đồng giữa các người dùng sử dụng hệ số tương quan Pearson
   */
  calculateUserSimilarity(ratingMatrix, userA, userB) {
    const commonMovies: string[] = [];

    // Tìm các phim mà cả hai người dùng đều đánh giá
    for (const movieId in ratingMatrix[userA]) {
      if (
        ratingMatrix[userA][movieId] > 0 &&
        ratingMatrix[userB][movieId] > 0
      ) {
        commonMovies.push(movieId);
      }
    }

    // Nếu không có phim chung, trả về 0
    if (commonMovies.length === 0) {
      return 0;
    }

    // Tính trung bình đánh giá của mỗi người dùng
    let sumA = 0,
      sumB = 0;
    commonMovies.forEach((movieId) => {
      sumA += ratingMatrix[userA][movieId];
      sumB += ratingMatrix[userB][movieId];
    });

    const avgA = sumA / commonMovies.length;
    const avgB = sumB / commonMovies.length;

    // Tính tử số và mẫu số của hệ số tương quan Pearson
    let numerator = 0;
    let denominatorA = 0;
    let denominatorB = 0;

    commonMovies.forEach((movieId) => {
      const diffA = ratingMatrix[userA][movieId] - avgA;
      const diffB = ratingMatrix[userB][movieId] - avgB;

      numerator += diffA * diffB;
      denominatorA += diffA * diffA;
      denominatorB += diffB * diffB;
    });

    // Tránh chia cho 0
    if (denominatorA === 0 || denominatorB === 0) {
      return 0;
    }

    // Tính hệ số tương quan Pearson
    const similarity =
      numerator / (Math.sqrt(denominatorA) * Math.sqrt(denominatorB));

    // Đảm bảo giá trị nằm trong khoảng [-1, 1]
    return Math.max(-1, Math.min(1, similarity));
  }

  /**
   * Huấn luyện gợi ý cá nhân hóa (personal recommendations)
   * Có thể truyền userId để train cho 1 user, hoặc không truyền để train cho tất cả user
   */
  @Cron('0 2 * * 2')
  async trainPersonalRecommendations(userId?: number) {
    try {
      this.logger.log(
        `Training personal recommendations${userId ? ` for user ${userId}` : ' for all customers'}...`,
      );
      if (userId) {
        await this.recommendationQueue.add(
          'generate-personal-recommendations',
          { userId },
        );
      } else {
        // Lấy tất cả user có role là 'customer'
        const users = await this.userModel.findAll({
          where: { role: 'customer' },
        });
        for (const user of users) {
          await this.recommendationQueue.add(
            'generate-personal-recommendations',
            { userId: user.id },
          );
        }
      }
      this.logger.log('Added personal recommendations job(s) to queue');
    } catch (error) {
      this.logger.error(
        `Error queueing personal recommendations job: ${error.message}`,
        error.stack,
      );
    }
  }
}

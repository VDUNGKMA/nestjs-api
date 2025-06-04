import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';

// Models
import { MovieRating } from '../../../models/movie-rating.model';
import { Movie } from '../../../models/movie.model';
import { User } from '../../../models/user.model';
import { Ticket } from '../../../models/ticket.model';
import { MovieSimilarity } from '../../../models/movie-similarity.model';

// Khai báo interface cho các object dùng trong map/filter
interface SimilarUser {
  userId: number;
  similarity: number;
}
interface MovieScore {
  movie_id: number;
  totalScore: number;
  totalSimilarity: number;
  count: number;
  movie?: any;
}

@Injectable()
export class CollaborativeFilteringService {
  private readonly logger = new Logger(CollaborativeFilteringService.name);

  constructor(
    @InjectModel(MovieRating)
    private movieRatingModel: typeof MovieRating,
    @InjectModel(Movie)
    private movieModel: typeof Movie,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Ticket)
    private ticketModel: typeof Ticket,
    @InjectModel(MovieSimilarity)
    private movieSimilarityModel: typeof MovieSimilarity,
    private readonly sequelize: Sequelize,
  ) {}

  /**
   * Lấy gợi ý dựa trên lọc cộng tác cho người dùng
   * Sử dụng phương pháp lọc cộng tác dựa trên người dùng (User-based Collaborative Filtering)
   */
  async getRecommendations(userId: number) {
    try {
      // Kiểm tra xem người dùng có tồn tại không
      const user = await this.userModel.findByPk(userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      // Lấy danh sách đánh giá của người dùng hiện tại
      const userRatings = await this.getUserRatings(userId);

      // Nếu người dùng chưa có đánh giá nào, sử dụng lịch sử xem phim
      if (userRatings.length === 0) {
        return this.getRecommendationsFromWatchHistory(userId);
      }

      // Lấy danh sách người dùng tương tự
      const similarUsers = await this.findSimilarUsers(userId, userRatings);

      // Nếu không có người dùng tương tự, trả về danh sách trống
      if (similarUsers.length === 0) {
        return [];
      }

      // Lấy danh sách phim đã được đánh giá bởi người dùng hiện tại
      const ratedMovieIds = userRatings.map((rating) => rating.movie_id);

      // Lấy danh sách đánh giá của các người dùng tương tự
      const similarUserIds = similarUsers.map(
        (user: SimilarUser) => user.userId,
      );
      const similarUserRatings = await this.movieRatingModel.findAll({
        where: {
          user_id: similarUserIds,
          movie_id: {
            [Op.notIn]: ratedMovieIds, // Loại bỏ các phim đã được đánh giá
          },
        },
        include: [{ model: Movie, as: 'movie' }],
      });

      // Tính điểm dự đoán cho từng phim
      const movieScores: Map<number, MovieScore> = new Map();

      similarUserRatings.forEach((rating) => {
        const similarUser = similarUsers.find(
          (user) => user.userId === rating.user_id,
        );
        if (!similarUser) return;
        const predictedScore = rating.rating * similarUser.similarity;
        let current = movieScores.get(rating.movie_id);
        if (current) {
          movieScores.set(rating.movie_id, {
            ...current,
            totalScore: current.totalScore + predictedScore,
            totalSimilarity: current.totalSimilarity + similarUser.similarity,
            count: current.count + 1,
          });
        } else {
          movieScores.set(rating.movie_id, {
            movie_id: rating.movie_id,
            totalScore: predictedScore,
            totalSimilarity: similarUser.similarity,
            count: 1,
            movie: rating.movie,
          });
        }
      });

      // Tính điểm trung bình và sắp xếp
      const recommendations = Array.from(movieScores.values())
        .map((item) => ({
          movie_id: item.movie_id,
          score: item.totalScore / item.totalSimilarity,
          recommendation_type: 'collaborative',
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20); // Lấy 20 phim có điểm cao nhất

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error getting collaborative recommendations: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Lấy gợi ý dựa trên lịch sử xem phim
   * Sử dụng khi người dùng chưa có đánh giá nào
   */
  private async getRecommendationsFromWatchHistory(userId: number) {
    try {
      // Lấy danh sách phim đã xem
      const watchedMovieIds = await this.getWatchedMovieIds(userId);

      // Nếu không có phim nào, trả về danh sách trống
      if (watchedMovieIds.length === 0) {
        return [];
      }

      // Lấy các phim tương tự với các phim đã xem
      const similarities = await this.movieSimilarityModel.findAll({
        where: {
          movie_id_1: watchedMovieIds,
          movie_id_2: {
            [Op.notIn]: watchedMovieIds, // Loại bỏ các phim đã xem
          },
          similarity_type: 'collaborative',
        },
        order: [['similarity_score', 'DESC']],
      });

      // Gom nhóm theo movie_id_2 và tính điểm trung bình
      const movieScores: Map<number, MovieScore> = new Map();
      similarities.forEach((sim) => {
        let current = movieScores.get(sim.movie_id_2);
        if (current) {
          movieScores.set(sim.movie_id_2, {
            ...current,
            totalScore: current.totalScore + sim.similarity_score,
            count: current.count + 1,
            totalSimilarity: current.totalSimilarity ?? 0, // giữ nguyên nếu có
          });
        } else {
          movieScores.set(sim.movie_id_2, {
            movie_id: sim.movie_id_2,
            totalScore: sim.similarity_score,
            count: 1,
            totalSimilarity: 0,
          });
        }
      });

      // Tính điểm trung bình và sắp xếp
      const recommendations = Array.from(movieScores.values())
        .map((item) => ({
          movie_id: item.movie_id,
          score: item.totalScore / item.count,
          recommendation_type: 'collaborative',
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20); // Lấy 20 phim có điểm cao nhất

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error getting recommendations from watch history: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Lấy danh sách đánh giá của người dùng
   */
  private async getUserRatings(userId: number) {
    try {
      // Lấy danh sách đánh giá rõ ràng
      const explicitRatings = await this.movieRatingModel.findAll({
        where: { user_id: userId },
      });

      // Lấy danh sách đánh giá ngầm định từ lịch sử xem phim
      const implicitRatings = await this.getImplicitRatings(userId);

      // Kết hợp hai danh sách
      return [...explicitRatings, ...implicitRatings];
    } catch (error) {
      this.logger.error(
        `Error getting user ratings: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Lấy danh sách đánh giá ngầm định từ lịch sử xem phim
   * Đánh giá ngầm định được tính dựa trên việc người dùng đã xem phim
   */
  private async getImplicitRatings(userId: number) {
    try {
      // Lấy danh sách vé đã đặt
      const tickets = await this.ticketModel.findAll({
        where: {
          user_id: userId,
          status: 'completed', // Chỉ lấy các vé đã hoàn thành
        },
        include: [{ association: 'screening' }],
      });

      // Tạo danh sách đánh giá ngầm định
      const implicitRatings: {
        user_id: number;
        movie_id: number;
        rating: number;
      }[] = [];
      const movieIds = new Set();

      tickets.forEach((ticket) => {
        const movieId = ticket.screening?.movie_id;
        if (movieId && !movieIds.has(movieId)) {
          movieIds.add(movieId);
          implicitRatings.push({
            user_id: userId,
            movie_id: movieId,
            rating: 3.5, // Giả định rằng nếu người dùng đã xem phim, họ đánh giá ít nhất 3.5 sao
          });
        }
      });

      return implicitRatings;
    } catch (error) {
      this.logger.error(
        `Error getting implicit ratings: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Lấy danh sách ID của các phim đã xem
   */
  private async getWatchedMovieIds(userId: number) {
    try {
      // Lấy danh sách vé đã đặt
      const tickets = await this.ticketModel.findAll({
        where: {
          user_id: userId,
          status: 'completed', // Chỉ lấy các vé đã hoàn thành
        },
        include: [{ association: 'screening' }],
      });

      // Lấy danh sách ID của các phim đã xem
      const movieIds = new Set();
      tickets.forEach((ticket) => {
        const movieId = ticket.screening?.movie_id;
        if (movieId) {
          movieIds.add(movieId);
        }
      });

      return Array.from(movieIds);
    } catch (error) {
      this.logger.error(
        `Error getting watched movie IDs: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Tìm các người dùng tương tự với người dùng hiện tại
   */
  private async findSimilarUsers(userId: number, userRatings: any[]) {
    try {
      // Lấy danh sách ID của các phim đã được đánh giá
      const movieIds = userRatings.map((rating) => rating.movie_id);

      // Lấy danh sách đánh giá của các người dùng khác cho các phim này
      const otherUserRatings = await this.movieRatingModel.findAll({
        where: {
          movie_id: movieIds,
          user_id: {
            [Op.ne]: userId, // Loại bỏ người dùng hiện tại
          },
        },
      });

      // Gom nhóm đánh giá theo người dùng
      const userRatingsMap = new Map();
      otherUserRatings.forEach((rating) => {
        if (!userRatingsMap.has(rating.user_id)) {
          userRatingsMap.set(rating.user_id, []);
        }
        userRatingsMap.get(rating.user_id).push(rating);
      });

      // Tính độ tương đồng giữa người dùng hiện tại và các người dùng khác
      const similarUsers: SimilarUser[] = [];

      userRatingsMap.forEach((ratings, otherUserId) => {
        // Tính độ tương đồng Pearson
        const similarity = this.calculatePearsonSimilarity(
          userRatings,
          ratings,
        );

        // Chỉ giữ lại các người dùng có độ tương đồng dương
        if (similarity > 0) {
          similarUsers.push({
            userId: otherUserId,
            similarity,
          });
        }
      });

      // Sắp xếp theo độ tương đồng giảm dần và lấy 10 người dùng tương tự nhất
      return similarUsers
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10);
    } catch (error) {
      this.logger.error(
        `Error finding similar users: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Tính độ tương đồng Pearson giữa hai người dùng
   */
  private calculatePearsonSimilarity(
    userRatings1: any[],
    userRatings2: any[],
  ): number {
    // Tìm các phim được đánh giá bởi cả hai người dùng
    const commonMovies: { movie_id: any; rating1: any; rating2: any }[] = [];

    userRatings1.forEach((rating1) => {
      const rating2 = userRatings2.find((r) => r.movie_id === rating1.movie_id);
      if (rating2) {
        commonMovies.push({
          movie_id: rating1.movie_id,
          rating1: rating1.rating,
          rating2: rating2.rating,
        });
      }
    });

    // Nếu không có phim chung, trả về 0
    if (commonMovies.length === 0) {
      return 0;
    }

    // Tính trung bình đánh giá của mỗi người dùng
    const avg1 =
      commonMovies.reduce((sum, movie) => sum + movie.rating1, 0) /
      commonMovies.length;
    const avg2 =
      commonMovies.reduce((sum, movie) => sum + movie.rating2, 0) /
      commonMovies.length;

    // Tính tử số và mẫu số của công thức Pearson
    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    commonMovies.forEach((movie) => {
      const dev1 = movie.rating1 - avg1;
      const dev2 = movie.rating2 - avg2;

      numerator += dev1 * dev2;
      denominator1 += dev1 * dev1;
      denominator2 += dev2 * dev2;
    });

    // Tránh chia cho 0
    if (denominator1 === 0 || denominator2 === 0) {
      return 0;
    }

    // Tính hệ số tương quan Pearson
    return numerator / Math.sqrt(denominator1 * denominator2);
  }

  /**
   * Tính toán độ tương đồng giữa các phim dựa trên đánh giá của người dùng
   * Phương thức này sẽ được gọi định kỳ để cập nhật bảng MovieSimilarity
   */
  async calculateMovieSimilarities() {
    try {
      this.logger.log(
        'Calculating movie similarities based on user ratings...',
      );

      // Lấy tất cả các đánh giá
      const ratings = await this.movieRatingModel.findAll();

      // Gom nhóm đánh giá theo phim
      const movieRatingsMap = new Map();
      ratings.forEach((rating) => {
        if (!movieRatingsMap.has(rating.movie_id)) {
          movieRatingsMap.set(rating.movie_id, []);
        }
        movieRatingsMap.get(rating.movie_id).push(rating);
      });

      // Lấy danh sách ID của các phim
      const movieIds = Array.from(movieRatingsMap.keys());

      // Tạo transaction
      const transaction = await this.sequelize.transaction();

      try {
        // Xóa các bản ghi cũ
        await this.movieSimilarityModel.destroy({
          where: {
            similarity_type: 'collaborative',
          },
          transaction,
        });

        // Tính toán độ tương đồng giữa các cặp phim
        const similarities: {
          movie_id_1: any;
          movie_id_2: any;
          similarity_score: number;
          similarity_type: string;
          calculated_at: Date;
        }[] = [];

        for (let i = 0; i < movieIds.length; i++) {
          for (let j = i + 1; j < movieIds.length; j++) {
            const movieId1 = movieIds[i];
            const movieId2 = movieIds[j];

            const ratings1 = movieRatingsMap.get(movieId1);
            const ratings2 = movieRatingsMap.get(movieId2);

            // Tính điểm tương đồng
            const similarityScore = this.calculateItemSimilarity(
              ratings1,
              ratings2,
            );

            // Chỉ lưu các cặp có độ tương đồng dương
            if (similarityScore > 0) {
              // Thêm vào danh sách
              similarities.push({
                movie_id_1: movieId1,
                movie_id_2: movieId2,
                similarity_score: similarityScore,
                similarity_type: 'collaborative',
                calculated_at: new Date(),
              });

              // Thêm cặp ngược lại
              similarities.push({
                movie_id_1: movieId2,
                movie_id_2: movieId1,
                similarity_score: similarityScore,
                similarity_type: 'collaborative',
                calculated_at: new Date(),
              });
            }
          }
        }

        // Lưu vào cơ sở dữ liệu
        if (similarities.length > 0) {
          await this.movieSimilarityModel.bulkCreate(similarities, {
            transaction,
          });
        }

        // Commit transaction
        await transaction.commit();

        this.logger.log(
          `Calculated collaborative similarities for ${movieIds.length} movies`,
        );
      } catch (error) {
        // Rollback transaction nếu có lỗi
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error calculating movie similarities: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Tính độ tương đồng giữa hai phim dựa trên đánh giá của người dùng
   */
  private calculateItemSimilarity(ratings1: any[], ratings2: any[]): number {
    // Tìm các người dùng đã đánh giá cả hai phim
    const commonUsers: { user_id: any; rating1: any; rating2: any }[] = [];

    ratings1.forEach((rating1) => {
      const rating2 = ratings2.find((r) => r.user_id === rating1.user_id);
      if (rating2) {
        commonUsers.push({
          user_id: rating1.user_id,
          rating1: rating1.rating,
          rating2: rating2.rating,
        });
      }
    });

    // Nếu không có người dùng chung, trả về 0
    if (commonUsers.length === 0) {
      return 0;
    }

    // Tính trung bình đánh giá của mỗi phim
    const avg1 =
      commonUsers.reduce((sum, user) => sum + user.rating1, 0) /
      commonUsers.length;
    const avg2 =
      commonUsers.reduce((sum, user) => sum + user.rating2, 0) /
      commonUsers.length;

    // Tính tử số và mẫu số của công thức Pearson
    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    commonUsers.forEach((user) => {
      const dev1 = user.rating1 - avg1;
      const dev2 = user.rating2 - avg2;

      numerator += dev1 * dev2;
      denominator1 += dev1 * dev1;
      denominator2 += dev2 * dev2;
    });

    // Tránh chia cho 0
    if (denominator1 === 0 || denominator2 === 0) {
      return 0;
    }

    // Tính hệ số tương quan Pearson
    return numerator / Math.sqrt(denominator1 * denominator2);
  }
}

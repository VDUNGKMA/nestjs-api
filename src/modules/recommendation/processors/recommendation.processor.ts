import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
// Models
import { Movie } from '../../../models/movie.model';
import { User } from '../../../models/user.model';
import { MovieRating } from '../../../models/movie-rating.model';
import { UserPreference } from '../../../models/user-preference.model';
import { BookingRecommendation } from '../../../models/booking-recommendation.entity';

// Services
import { ModelTrainingService } from '../services/model-training.service';

@Processor('recommendation')
export class RecommendationProcessor {
  private readonly logger = new Logger(RecommendationProcessor.name);

  constructor(
    @InjectModel(Movie)
    private movieModel: typeof Movie,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(MovieRating)
    private movieRatingModel: typeof MovieRating,
    @InjectModel(UserPreference)
    private userPreferenceModel: typeof UserPreference,
    @InjectModel(BookingRecommendation)
    private bookingRecommendationModel: typeof BookingRecommendation,
    private readonly modelTrainingService: ModelTrainingService,
    private readonly sequelize: Sequelize,
  ) {}

  /**
   * Xử lý công việc huấn luyện mô hình lọc cộng tác
   */
  @Process('train-collaborative-model')
  private async handleTrainCollaborativeModel(job: Job<{ userId?: number }>) {
    try {
      const { userId } = job.data;
      this.logger.log(
        `Training collaborative model${userId ? ` for user ${userId}` : ' for all users'}...`,
      );

      // Tạo transaction
      const transaction = await this.sequelize.transaction();

      try {
        // Lấy danh sách người dùng
        const users = userId
          ? [await this.userModel.findByPk(userId, { transaction })]
          : await this.userModel.findAll({ transaction });

        // Lọc bỏ người dùng null
        const validUsers = users.filter((user) => user !== null);

        // Tính toán ma trận đánh giá người dùng-phim
        const userMovieRatings = await this.movieRatingModel.findAll({
          include: [{ association: 'user' }, { association: 'movie' }],
          transaction,
        });

        // Tạo map đánh giá theo người dùng
        const ratingsByUser = new Map();

        userMovieRatings.forEach((rating) => {
          if (!ratingsByUser.has(rating.user_id)) {
            ratingsByUser.set(rating.user_id, []);
          }

          ratingsByUser.get(rating.user_id).push(rating);
        });

        // Tạo ratingMatrix từ ratingsByUser
        const ratingMatrix = {};
        ratingsByUser.forEach((ratings, userId) => {
          ratingMatrix[userId] = {};
          ratings.forEach((rating) => {
            ratingMatrix[userId][rating.movie_id] = rating.rating;
          });
        });

        // Tính toán độ tương đồng giữa các người dùng
        for (const userA of validUsers) {
          // Lấy đánh giá của người dùng A
          const ratingsA = ratingsByUser.get(userA.id) || [];

          // Nếu người dùng A không có đánh giá nào, bỏ qua
          if (ratingsA.length === 0) {
            continue;
          }

          // Tìm người dùng tương tự
          const similarities: Array<{ userId: number; similarity: number }> =
            [];

          for (const userB of validUsers) {
            // Bỏ qua nếu là cùng một người dùng
            if (userA.id === userB.id) {
              continue;
            }

            // Lấy đánh giá của người dùng B
            const ratingsB = ratingsByUser.get(userB.id) || [];

            // Nếu người dùng B không có đánh giá nào, bỏ qua
            if (ratingsB.length === 0) {
              continue;
            }

            // Thay thế hàm tính độ tương đồng
            const similarity =
              this.modelTrainingService.calculateUserSimilarity(
                ratingMatrix,
                userA.id,
                userB.id,
              );

            // Nếu độ tương đồng > 0, thêm vào danh sách
            if (similarity > 0) {
              similarities.push({
                userId: userB.id,
                similarity,
              });
            }
          }

          // Sắp xếp theo độ tương đồng giảm dần
          similarities.sort((a, b) => b.similarity - a.similarity);

          // Lấy top 10 người dùng tương tự nhất
          const topSimilarUsers = similarities.slice(0, 10);

          // Cập nhật thông tin sở thích người dùng
          const userPreference = await this.userPreferenceModel.findOne({
            where: { user_id: userA.id },
            transaction,
          });

          if (userPreference) {
            await userPreference.update(
              {
                similar_users: topSimilarUsers.map((u) => ({
                  id: u.userId,
                  score: u.similarity,
                })),
                last_updated: new Date(),
              },
              { transaction },
            );
          } else {
            await this.userPreferenceModel.create(
              {
                user_id: userA.id,
                similar_users: topSimilarUsers.map((u) => ({
                  id: u.userId,
                  score: u.similarity,
                })),
                last_updated: new Date(),
              },
              { transaction },
            );
          }

          // Tạo gợi ý cộng tác cho người dùng
          await this.generateCollaborativeRecommendations(
            userA.id,
            topSimilarUsers,
            transaction,
          );
        }

        // Commit transaction
        await transaction.commit();

        this.logger.log(
          `Completed training collaborative model${userId ? ` for user ${userId}` : ' for all users'}`,
        );
        return { success: true };
      } catch (error) {
        // Rollback transaction nếu có lỗi
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error training collaborative model: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Xử lý công việc huấn luyện mô hình Wide & Deep
   */
  @Process('train-widedeep-model')
  async handleTrainWideDeepModel(job: Job) {
    try {
      this.logger.log(`Processing Wide & Deep model training job ${job.id}...`);

      // Lấy tất cả người dùng
      const users = await this.userModel.findAll();

      // Tạo transaction
      const transaction = await this.sequelize.transaction();

      try {
        // Đối với mỗi người dùng, tạo gợi ý sử dụng mô hình Wide & Deep
        for (const user of users) {
          await this.generateWideDeepRecommendations(user.id, transaction);
        }

        // Commit transaction
        await transaction.commit();

        this.logger.log(`Completed Wide & Deep model training job ${job.id}`);
        return { success: true };
      } catch (error) {
        // Rollback transaction nếu có lỗi
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error processing Wide & Deep model training job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Tạo gợi ý phim dựa trên lọc cộng tác
   */
  private async generateCollaborativeRecommendations(
    userId: number,
    similarUsers: Array<{ userId: number; similarity: number }>,
    transaction: any,
  ) {
    try {
      // Lấy danh sách phim đã được đánh giá bởi người dùng hiện tại
      const userRatings = await this.movieRatingModel.findAll({
        where: { user_id: userId },
        transaction,
      });

      const ratedMovieIds = userRatings.map((rating) => rating.movie_id);

      // Lấy tất cả phim
      const allMovies = await this.movieModel.findAll({
        where: {
          id: {
            [Op.notIn]: ratedMovieIds, // Loại bỏ các phim đã được đánh giá
          },
        },
        transaction,
      });

      // Tính điểm dự đoán cho từng phim
      const predictions: Array<{ movieId: number; score: number }> = [];

      for (const movie of allMovies) {
        let weightedSum = 0;
        let similaritySum = 0;

        // Tính điểm dự đoán dựa trên đánh giá của người dùng tương tự
        for (const { userId: similarUserId, similarity } of similarUsers) {
          // Lấy đánh giá của người dùng tương tự cho phim này
          const rating = await this.movieRatingModel.findOne({
            where: {
              user_id: similarUserId,
              movie_id: movie.id,
            },
            transaction,
          });

          // Nếu người dùng tương tự đã đánh giá phim này
          if (rating) {
            weightedSum += rating.rating * similarity;
            similaritySum += similarity;
          }
        }

        // Tính điểm dự đoán
        if (similaritySum > 0) {
          const predictedRating = weightedSum / similaritySum;

          // Chỉ lưu các dự đoán có điểm > 3.5
          if (predictedRating > 3.5) {
            predictions.push({
              movieId: movie.id,
              score: predictedRating,
            });
          }
        }
      }

      // Sắp xếp theo điểm dự đoán giảm dần
      predictions.sort((a, b) => b.score - a.score);

      // Lấy top 20 phim được gợi ý
      const topRecommendations = predictions.slice(0, 20);

      // Lưu các gợi ý vào cơ sở dữ liệu
      for (const { movieId, score } of topRecommendations) {
        await this.bookingRecommendationModel.findOrCreate({
          where: {
            user_id: userId,
            movie_id: movieId,
            recommendation_type: 'collaborative',
          },
          defaults: {
            user_id: userId,
            movie_id: movieId,
            recommendation_type: 'collaborative',
            score,
            context_data: JSON.stringify({
              method: 'user-based',
              similar_users: similarUsers.slice(0, 5).map((u) => u.userId),
            }),
            is_clicked: false,
            is_booked: false,
            created_at: new Date(),
          },
          transaction,
        });
      }

      return topRecommendations;
    } catch (error) {
      this.logger.error(
        `Error generating collaborative recommendations for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Tạo gợi ý phim sử dụng mô hình Wide & Deep
   * Lưu ý: Đây là mô phỏng của mô hình Wide & Deep, trong thực tế sẽ cần tích hợp với một framework ML
   */
  private async generateWideDeepRecommendations(
    userId: number,
    transaction: any,
  ) {
    try {
      // Lấy thông tin sở thích người dùng
      const userPreference = await this.userPreferenceModel.findOne({
        where: { user_id: userId },
        transaction,
      });

      if (!userPreference) {
        return [];
      }

      // Lấy danh sách phim đã xem
      const watchedMovies = new Set(userPreference.watch_history || []);

      // Lấy tất cả phim
      const allMovies = await this.movieModel.findAll({
        include: [{ association: 'genres' }],
        transaction,
      });

      // Tính điểm cho mỗi phim chưa xem
      const predictions: Array<{
        movieId: number;
        score: number;
        wideScore: number;
        deepScore: number;
      }> = [];

      for (const movie of allMovies) {
        // Bỏ qua phim đã xem
        if (watchedMovies.has(movie.id)) {
          continue;
        }

        // Tính điểm Wide (tuyến tính)
        let wideScore = 0;

        // Kiểm tra thể loại yêu thích
        if (userPreference.favorite_genres && movie.genres) {
          const favoriteGenres = new Set(userPreference.favorite_genres);
          movie.genres.forEach((genre) => {
            if (favoriteGenres.has(genre.name)) {
              wideScore += 0.2;
            }
          });
        }

        // Kiểm tra đạo diễn yêu thích
        if (userPreference.favorite_directors && movie.director) {
          const favoriteDirectors = new Set(userPreference.favorite_directors);
          if (favoriteDirectors.has(movie.director)) {
            wideScore += 0.3;
          }
        }

        // Kiểm tra diễn viên yêu thích
        if (userPreference.favorite_actors && movie.cast) {
          const favoriteActors = new Set(userPreference.favorite_actors);
          const movieActors = movie.cast
            .split(',')
            .map((actor) => actor.trim());

          movieActors.forEach((actor) => {
            if (favoriteActors.has(actor)) {
              wideScore += 0.1;
            }
          });
        }

        // Tính điểm Deep (phi tuyến)
        let deepScore = 0;

        // Kết hợp đánh giá rõ ràng và ngầm định
        const explicitRating = userPreference.explicit_ratings?.[movie.id] || 0;
        const implicitRating = userPreference.implicit_ratings?.[movie.id] || 0;

        if (explicitRating > 0) {
          deepScore += explicitRating * 0.4;
        }

        if (implicitRating > 0) {
          deepScore += implicitRating * 0.2;
        }

        // Thêm điểm dựa trên độ phổ biến của phim
        deepScore += (movie.popularity || 0) * 0.1;

        // Thêm điểm dựa trên đánh giá trung bình của phim
        deepScore += (movie.rating || 0) * 0.2;

        // Kết hợp điểm Wide và Deep
        const finalScore = wideScore * 0.4 + deepScore * 0.6;

        // Chỉ lưu các dự đoán có điểm > 0.5
        if (finalScore > 0.5) {
          predictions.push({
            movieId: movie.id,
            score: finalScore,
            wideScore,
            deepScore,
          });
        }
      }

      // Sắp xếp theo điểm dự đoán giảm dần
      predictions.sort((a, b) => b.score - a.score);

      // Lấy top 20 phim được gợi ý
      const topRecommendations = predictions.slice(0, 20);

      // Lưu các gợi ý vào cơ sở dữ liệu
      for (const {
        movieId,
        score,
        wideScore,
        deepScore,
      } of topRecommendations) {
        await this.bookingRecommendationModel.findOrCreate({
          where: {
            user_id: userId,
            movie_id: movieId,
            recommendation_type: 'widedeep',
          },
          defaults: {
            user_id: userId,
            movie_id: movieId,
            recommendation_type: 'widedeep',
            score,
            context_data: JSON.stringify({
              wide_score: wideScore,
              deep_score: deepScore,
            }),
            is_clicked: false,
            is_booked: false,
            created_at: new Date(),
          },
          transaction,
        });
      }

      return topRecommendations;
    } catch (error) {
      this.logger.error(
        `Error generating Wide & Deep recommendations for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Xử lý công việc tạo gợi ý cá nhân hóa
   */
  @Process('generate-personal-recommendations')
  async handleGeneratePersonalRecommendations(job: Job<{ userId: number }>) {
    try {
      const { userId } = job.data;
      this.logger.log(
        `Processing personal recommendations job for user ${userId}...`,
      );

      // Tạo transaction
      const transaction = await this.sequelize.transaction();

      try {
        // Lấy thông tin người dùng
        const user = await this.userModel.findByPk(userId, { transaction });

        if (!user) {
          throw new Error(`User with ID ${userId} not found`);
        }

        // Lấy thông tin sở thích người dùng
        const userPreference = await this.userPreferenceModel.findOne({
          where: { user_id: userId },
          transaction,
        });

        if (!userPreference) {
          throw new Error(`User preference for user ${userId} not found`);
        }

        // Lấy danh sách phim đã xem
        const watchedMovies = new Set(userPreference.watch_history || []);

        // Lấy các gợi ý hiện có
        const existingRecommendations =
          await this.bookingRecommendationModel.findAll({
            where: {
              user_id: userId,
            },
            transaction,
          });

        // Tạo map các gợi ý theo loại
        const recommendationsByType = {};

        existingRecommendations.forEach((rec) => {
          if (!recommendationsByType[rec.recommendation_type]) {
            recommendationsByType[rec.recommendation_type] = [];
          }

          recommendationsByType[rec.recommendation_type].push({
            movieId: rec.movie_id,
            score: rec.score,
            isClicked: rec.is_clicked,
            isBooked: rec.is_booked,
          });
        });

        // Kết hợp các gợi ý từ các phương pháp khác nhau
        const combinedRecommendations: Array<{
          movieId: number;
          score: number;
          usedMethods: number;
        }> = [];

        // Trọng số cho mỗi phương pháp
        const weights = {
          widedeep: 0.4,
          collaborative: 0.3,
          content: 0.2,
          context: 0.1,
        };

        // Lấy tất cả phim
        const allMovies = await this.movieModel.findAll({ transaction });

        // Tính điểm kết hợp cho mỗi phim
        for (const movie of allMovies) {
          // Bỏ qua phim đã xem
          if (watchedMovies.has(movie.id)) {
            continue;
          }

          let combinedScore = 0;
          let usedMethods = 0;

          // Kết hợp điểm từ các phương pháp khác nhau
          for (const [type, weight] of Object.entries(weights)) {
            const recommendations = recommendationsByType[type] || [];
            const recommendation = recommendations.find(
              (r) => r.movieId === movie.id,
            );

            if (recommendation) {
              combinedScore += recommendation.score * weight;
              usedMethods++;
            }
          }

          // Chỉ lưu các phim có ít nhất một phương pháp gợi ý
          if (usedMethods > 0) {
            // Chuẩn hóa điểm
            const normalizedScore = combinedScore / usedMethods;

            combinedRecommendations.push({
              movieId: movie.id,
              score: normalizedScore,
              usedMethods,
            });
          }
        }

        // Sắp xếp theo điểm giảm dần
        combinedRecommendations.sort((a, b) => b.score - a.score);

        // Lấy top 20 phim được gợi ý
        const topRecommendations = combinedRecommendations.slice(0, 20);

        // Lưu các gợi ý vào cơ sở dữ liệu
        for (const { movieId, score, usedMethods } of topRecommendations) {
          await this.bookingRecommendationModel.findOrCreate({
            where: {
              user_id: userId,
              movie_id: movieId,
              recommendation_type: 'personal',
            },
            defaults: {
              user_id: userId,
              movie_id: movieId,
              recommendation_type: 'personal',
              score,
              context_data: JSON.stringify({
                used_methods: usedMethods,
                timestamp: new Date().toISOString(),
              }),
              is_clicked: false,
              is_booked: false,
              created_at: new Date(),
            },
            transaction,
          });
        }

        // Commit transaction
        await transaction.commit();

        this.logger.log(
          `Completed personal recommendations job for user ${userId}`,
        );
        return { success: true, recommendations: topRecommendations };
      } catch (error) {
        // Rollback transaction nếu có lỗi
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error processing personal recommendations job for user ${job.data.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

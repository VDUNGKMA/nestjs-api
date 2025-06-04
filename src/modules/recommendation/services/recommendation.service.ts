import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
// Services
import { ContentBasedService } from './content-based.service';
import { CollaborativeFilteringService } from './collaborative-filtering.service';
import { ContextAwareService } from './context-aware.service';
import { DataCollectionService } from './data-collection.service';

// Models
import { BookingRecommendation } from '../../../models/booking-recommendation.entity';
import { UserPreference } from '../../../models/user-preference.model';
import { MovieSimilarity } from '../../../models/movie-similarity.model';
import { Movie } from '../../../models/movie.model';
import { User } from '../../../models/user.model';

// DTOs
import { CreateRecommendationDto } from '../dto/create-recommendation.dto';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    @InjectModel(BookingRecommendation)
    private bookingRecommendationModel: typeof BookingRecommendation,
    @InjectModel(UserPreference)
    private userPreferenceModel: typeof UserPreference,
    @InjectModel(MovieSimilarity)
    private movieSimilarityModel: typeof MovieSimilarity,
    @InjectModel(Movie)
    private movieModel: typeof Movie,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectQueue('recommendation') private recommendationQueue: Queue,
    private readonly contentBasedService: ContentBasedService,
    private readonly collaborativeFilteringService: CollaborativeFilteringService,
    private readonly contextAwareService: ContextAwareService,
    private readonly dataCollectionService: DataCollectionService,
    private readonly sequelize: Sequelize,
  ) {}

  /**
   * Lấy gợi ý cá nhân cho người dùng
   * Kết hợp các phương pháp gợi ý khác nhau để tạo ra danh sách gợi ý tốt nhất
   */
  async getPersonalRecommendations(userId: number) {
    try {
      // Kiểm tra xem người dùng có tồn tại không
      const user = await this.userModel.findByPk(userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      // Lấy sở thích của người dùng
      const userPreference = await this.getUserPreferences(userId);

      // Lấy gợi ý từ các phương pháp khác nhau
      const contentBasedRecommendations =
        await this.contentBasedService.getRecommendations(
          userId,
          userPreference,
        );
      const collaborativeRecommendations =
        await this.collaborativeFilteringService.getRecommendations(userId);
      const contextAwareRecommendations =
        await this.contextAwareService.getRecommendations(userId);

      // Kết hợp các gợi ý và sắp xếp theo điểm số
      const allRecommendations = [
        ...contentBasedRecommendations,
        ...collaborativeRecommendations,
        ...contextAwareRecommendations,
      ];

      // Gom nhóm theo movie_id và lấy điểm cao nhất
      const movieMap = new Map();
      allRecommendations.forEach((rec) => {
        if (
          !movieMap.has(rec.movie_id) ||
          movieMap.get(rec.movie_id).score < rec.score
        ) {
          movieMap.set(rec.movie_id, rec);
        }
      });

      // Chuyển đổi Map thành mảng và sắp xếp theo điểm số giảm dần
      const combinedRecommendations = Array.from(movieMap.values()).sort(
        (a, b) => b.score - a.score,
      );

      // Lấy thông tin chi tiết của phim
      const movieIds = combinedRecommendations.map((rec) => rec.movie_id);
      const movies = await this.movieModel.findAll({
        where: { id: movieIds },
        include: [{ association: 'genres' }],
      });

      // Kết hợp thông tin phim với gợi ý
      const result = combinedRecommendations.map((rec) => {
        const movie = movies.find((m) => m.id === rec.movie_id);
        return {
          ...rec,
          movie,
        };
      });

      // Lưu các gợi ý vào cơ sở dữ liệu để theo dõi
      this.saveRecommendations(userId, combinedRecommendations);

      return result;
    } catch (error) {
      this.logger.error(
        `Error getting personal recommendations: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Lấy gợi ý sử dụng mô hình Wide & Deep Learning
   */
  async getWideDeepRecommendations(userId: number) {
    try {
      // Gọi API của mô hình Wide & Deep Learning
      // Trong thực tế, bạn có thể sử dụng TensorFlow Serving hoặc một dịch vụ ML khác
      // Ở đây, chúng ta sẽ giả lập bằng cách kết hợp content-based và collaborative filtering
      const contentBasedRecommendations =
        await this.contentBasedService.getRecommendations(userId);
      const collaborativeRecommendations =
        await this.collaborativeFilteringService.getRecommendations(userId);

      // Kết hợp các gợi ý và sắp xếp theo điểm số
      const allRecommendations = [
        ...contentBasedRecommendations.map((rec) => ({
          ...rec,
          score: rec.score * 0.7,
        })), // Trọng số 0.7 cho content-based
        ...collaborativeRecommendations.map((rec) => ({
          ...rec,
          score: rec.score * 0.3,
        })), // Trọng số 0.3 cho collaborative
      ];

      // Gom nhóm theo movie_id và tính tổng điểm
      const movieMap = new Map();
      allRecommendations.forEach((rec) => {
        if (!movieMap.has(rec.movie_id)) {
          movieMap.set(rec.movie_id, { ...rec, count: 1 });
        } else {
          const existing = movieMap.get(rec.movie_id);
          movieMap.set(rec.movie_id, {
            ...existing,
            score: existing.score + rec.score,
            count: existing.count + 1,
          });
        }
      });

      // Tính điểm trung bình và sắp xếp
      const combinedRecommendations = Array.from(movieMap.values())
        .map((rec) => ({
          movie_id: rec.movie_id,
          score: rec.score / rec.count,
          recommendation_type: 'widedeep',
        }))
        .sort((a, b) => b.score - a.score);

      // Lấy thông tin chi tiết của phim
      const movieIds = combinedRecommendations.map((rec) => rec.movie_id);
      const movies = await this.movieModel.findAll({
        where: { id: movieIds },
        include: [{ association: 'genres' }],
      });

      // Kết hợp thông tin phim với gợi ý
      return combinedRecommendations.map((rec) => {
        const movie = movies.find((m) => m.id === rec.movie_id);
        return {
          ...rec,
          movie,
        };
      });
    } catch (error) {
      this.logger.error(
        `Error getting wide & deep recommendations: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Lấy gợi ý dựa trên thời gian hiện tại
   */
  async getRecommendationsByTime() {
    return this.contextAwareService.getRecommendationsByTime();
  }

  /**
   * Lấy gợi ý dựa trên vị trí địa lý
   */
  async getRecommendationsByLocation(latitude: number, longitude: number) {
    return this.contextAwareService.getRecommendationsByLocation(
      latitude,
      longitude,
    );
  }

  /**
   * Lấy gợi ý dựa trên thời tiết hiện tại
   */
  async getRecommendationsByWeather(latitude: number, longitude: number) {
    return this.contextAwareService.getRecommendationsByWeather(
      latitude,
      longitude,
    );
  }

  /**
   * Lấy các phim tương tự với phim đã cho
   */
  async getSimilarMovies(movieId: number) {
    try {
      // Kiểm tra xem phim có tồn tại không
      const movie = await this.movieModel.findByPk(movieId);
      if (!movie) {
        throw new Error(`Movie with ID ${movieId} not found`);
      }

      // Lấy các phim tương tự từ bảng MovieSimilarity
      const similarities = await this.movieSimilarityModel.findAll({
        where: { movie_id_1: movieId },
        order: [['similarity_score', 'DESC']],
        limit: 10,
      });

      // Lấy thông tin chi tiết của các phim tương tự
      const similarMovieIds = similarities.map((sim) => sim.movie_id_2);
      const similarMovies = await this.movieModel.findAll({
        where: { id: similarMovieIds },
        include: [{ association: 'genres' }],
      });

      // Kết hợp thông tin phim với điểm tương đồng
      return similarities.map((sim) => {
        const movie = similarMovies.find((m) => m.id === sim.movie_id_2);
        return {
          similarity_score: sim.similarity_score,
          similarity_type: sim.similarity_type,
          movie,
        };
      });
    } catch (error) {
      this.logger.error(
        `Error getting similar movies: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Lấy các phim đang thịnh hành
   */
  async getTrendingMovies() {
    try {
      // Lấy các phim có nhiều lượt đặt vé nhất trong 7 ngày qua
      const trendingMovies = await this.movieModel.findAll({
        order: [['popularity', 'DESC']],
        limit: 10,
        include: [{ association: 'genres' }],
      });

      return trendingMovies;
    } catch (error) {
      this.logger.error(
        `Error getting trending movies: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Lấy các phim mới
   */
  async getNewMovies() {
    try {
      // Lấy các phim mới phát hành trong 30 ngày qua
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const newMovies = await this.movieModel.findAll({
        where: {
          release_date: {
            [Op.gte]: thirtyDaysAgo,
          },
        },
        order: [['release_date', 'DESC']],
        include: [{ association: 'genres' }],
      });

      return newMovies;
    } catch (error) {
      this.logger.error(
        `Error getting new movies: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Ghi nhận phản hồi về gợi ý
   */
  async recordRecommendationFeedback(
    userId: number,
    createRecommendationDto: CreateRecommendationDto,
  ) {
    try {
      const {
        movie_id,
        recommendation_type,
        score,
        context_data,
        is_clicked,
        is_booked,
      } = createRecommendationDto;

      // Tìm hoặc tạo mới bản ghi BookingRecommendation
      const [recommendation, created] =
        await this.bookingRecommendationModel.findOrCreate({
          where: { user_id: userId, movie_id },
          defaults: {
            user_id: userId,
            movie_id,
            recommendation_type,
            score,
            context_data,
            is_clicked: is_clicked || false,
            is_booked: is_booked || false,
            clicked_at: is_clicked ? new Date() : null,
            booked_at: is_booked ? new Date() : null,
          },
        });

      // Nếu bản ghi đã tồn tại, cập nhật nó
      if (!created) {
        await recommendation.update({
          recommendation_type,
          score,
          context_data,
          is_clicked:
            is_clicked !== undefined ? is_clicked : recommendation.is_clicked,
          is_booked:
            is_booked !== undefined ? is_booked : recommendation.is_booked,
          clicked_at:
            is_clicked && !recommendation.clicked_at
              ? new Date()
              : recommendation.clicked_at,
          booked_at:
            is_booked && !recommendation.booked_at
              ? new Date()
              : recommendation.booked_at,
        });
      }

      // Thêm vào hàng đợi để cập nhật mô hình
      await this.recommendationQueue.add('update-model', {
        userId,
        movieId: movie_id,
        action: is_booked ? 'booked' : is_clicked ? 'clicked' : 'recommended',
        timestamp: new Date(),
      });

      return recommendation;
    } catch (error) {
      this.logger.error(
        `Error recording recommendation feedback: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Lưu các gợi ý vào cơ sở dữ liệu để theo dõi
   */
  private async saveRecommendations(userId: number, recommendations: any[]) {
    try {
      const transaction = await this.sequelize.transaction();

      try {
        for (const rec of recommendations) {
          await this.bookingRecommendationModel.findOrCreate({
            where: { user_id: userId, movie_id: rec.movie_id },
            defaults: {
              user_id: userId,
              movie_id: rec.movie_id,
              recommendation_type: rec.recommendation_type,
              score: rec.score,
              context_data: rec.context_data,
              is_clicked: false,
              is_booked: false,
            },
            transaction,
          });
        }

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error saving recommendations: ${error.message}`,
        error.stack,
      );
      // Không ném lỗi ở đây để không ảnh hưởng đến API response
    }
  }

  /**
   * Lấy thông tin sở thích của người dùng
   */
  async getUserPreferences(userId: number) {
    try {
      // Tìm hoặc tạo mới bản ghi UserPreference
      const [userPreference, created] =
        await this.userPreferenceModel.findOrCreate({
          where: { user_id: userId },
          defaults: {
            user_id: userId,
            last_updated: new Date(),
          },
        });

      return userPreference;
    } catch (error) {
      this.logger.error(
        `Error getting user preferences: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Cập nhật sở thích của người dùng
   */
  async updateUserPreferences(userId: number, preferences: any) {
    try {
      // Tìm hoặc tạo mới bản ghi UserPreference
      const [userPreference, created] =
        await this.userPreferenceModel.findOrCreate({
          where: { user_id: userId },
          defaults: {
            user_id: userId,
            ...preferences,
            last_updated: new Date(),
          },
        });

      // Nếu bản ghi đã tồn tại, cập nhật nó
      if (!created) {
        await userPreference.update({
          ...preferences,
          last_updated: new Date(),
        });
      }

      return userPreference;
    } catch (error) {
      this.logger.error(
        `Error updating user preferences: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

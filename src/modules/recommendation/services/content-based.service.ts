import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';

// Models
import { Movie } from '../../../models/movie.model';
import { MovieSimilarity } from '../../../models/movie-similarity.model';
import { MovieRating } from '../../../models/movie-rating.model';
import { UserPreference } from '../../../models/user-preference.model';
import { Ticket } from '../../../models/ticket.model';

// Khai báo interface cho các object dùng trong map/filter
interface MovieScore {
  movie_id: number;
  totalScore: number;
  count: number;
}

@Injectable()
export class ContentBasedService {
  private readonly logger = new Logger(ContentBasedService.name);

  constructor(
    @InjectModel(Movie)
    private movieModel: typeof Movie,
    @InjectModel(MovieSimilarity)
    private movieSimilarityModel: typeof MovieSimilarity,
    @InjectModel(MovieRating)
    private movieRatingModel: typeof MovieRating,
    @InjectModel(UserPreference)
    private userPreferenceModel: typeof UserPreference,
    @InjectModel(Ticket)
    private ticketModel: typeof Ticket,
    private readonly sequelize: Sequelize,
  ) {}

  /**
   * Lấy gợi ý dựa trên nội dung cho người dùng
   * Sử dụng thông tin về sở thích của người dùng và độ tương đồng giữa các phim
   */
  async getRecommendations(userId: number, userPreference?: any) {
    try {
      // Nếu không có thông tin sở thích, lấy từ cơ sở dữ liệu
      if (!userPreference) {
        userPreference = await this.userPreferenceModel.findOne({
          where: { user_id: userId },
        });
      }

      // Nếu vẫn không có thông tin sở thích, tạo mới dựa trên lịch sử xem phim
      if (!userPreference) {
        userPreference = await this.createUserPreference(userId);
      }

      // Lấy danh sách phim đã xem
      const watchedMovies = await this.getWatchedMovies(userId);
      const watchedMovieIds = watchedMovies.map((movie: Movie) => movie.id);

      // Lấy danh sách phim được đánh giá cao
      const highlyRatedMovies = await this.getHighlyRatedMovies(userId);
      const highlyRatedMovieIds = highlyRatedMovies.map(
        (rating) => rating.movie_id,
      );

      // Kết hợp danh sách phim đã xem và phim được đánh giá cao
      const seedMovieIds = [
        ...new Set([...watchedMovieIds, ...highlyRatedMovieIds]),
      ];

      // Nếu không có phim nào, trả về danh sách trống
      if (seedMovieIds.length === 0) {
        return [];
      }

      // Lấy các phim tương tự với các phim đã xem và được đánh giá cao
      const similarities = await this.movieSimilarityModel.findAll({
        where: {
          movie_id_1: seedMovieIds,
          movie_id_2: {
            [Op.notIn]: seedMovieIds, // Loại bỏ các phim đã xem
          },
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
          });
        } else {
          movieScores.set(sim.movie_id_2, {
            movie_id: sim.movie_id_2,
            totalScore: sim.similarity_score,
            count: 1,
          });
        }
      });

      // Tính điểm trung bình và sắp xếp
      const recommendations = Array.from(movieScores.values())
        .map((item) => ({
          movie_id: item.movie_id,
          score: item.totalScore / item.count,
          recommendation_type: 'content-based',
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20); // Lấy 20 phim có điểm cao nhất

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error getting content-based recommendations: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Tạo mới thông tin sở thích của người dùng dựa trên lịch sử xem phim
   */
  private async createUserPreference(userId: number) {
    try {
      // Lấy danh sách phim đã xem
      const watchedMovies = await this.getWatchedMovies(userId);

      // Nếu không có phim nào, trả về null
      if (watchedMovies.length === 0) {
        return null;
      }

      // Tính toán thể loại yêu thích
      const genreCounts = new Map();
      watchedMovies.forEach((movie) => {
        movie.genres.forEach((genre) => {
          const count = genreCounts.get(genre.name) || 0;
          genreCounts.set(genre.name, count + 1);
        });
      });

      // Sắp xếp thể loại theo số lượng giảm dần
      const favoriteGenres = Array.from(genreCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map((entry) => entry[0]);

      // Tính toán đạo diễn yêu thích
      const directorCounts = new Map();
      watchedMovies.forEach((movie) => {
        if (movie.director) {
          const count = directorCounts.get(movie.director) || 0;
          directorCounts.set(movie.director, count + 1);
        }
      });

      // Sắp xếp đạo diễn theo số lượng giảm dần
      const favoriteDirectors = Array.from(directorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map((entry) => entry[0]);

      // Tính toán diễn viên yêu thích
      const actorCounts = new Map();
      watchedMovies.forEach((movie) => {
        if (movie.cast) {
          const actors = movie.cast.split(',').map((actor) => actor.trim());
          actors.forEach((actor) => {
            const count = actorCounts.get(actor) || 0;
            actorCounts.set(actor, count + 1);
          });
        }
      });

      // Sắp xếp diễn viên theo số lượng giảm dần
      const favoriteActors = Array.from(actorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map((entry) => entry[0]);

      // Lấy danh sách ID của các phim đã xem
      const watchHistory = watchedMovies.map((movie: Movie) => movie.id);

      // Tạo mới hoặc cập nhật thông tin sở thích
      const [userPreference, created] =
        await this.userPreferenceModel.findOrCreate({
          where: { user_id: userId },
          defaults: {
            user_id: userId,
            favorite_genres: favoriteGenres,
            favorite_directors: favoriteDirectors,
            favorite_actors: favoriteActors,
            watch_history: watchHistory,
            last_updated: new Date(),
          },
        });

      // Nếu đã tồn tại, cập nhật thông tin
      if (!created) {
        await userPreference.update({
          favorite_genres: favoriteGenres,
          favorite_directors: favoriteDirectors,
          favorite_actors: favoriteActors,
          watch_history: watchHistory,
          last_updated: new Date(),
        });
      }

      return userPreference;
    } catch (error) {
      this.logger.error(
        `Error creating user preference: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Lấy danh sách phim đã xem của người dùng
   */
  private async getWatchedMovies(userId: number) {
    try {
      // Lấy danh sách vé đã đặt
      const tickets = await this.ticketModel.findAll({
        where: {
          user_id: userId,
          status: 'completed', // Chỉ lấy các vé đã hoàn thành
        },
        include: [
          {
            association: 'screening',
            include: [
              {
                association: 'movie',
                include: [{ association: 'genres' }],
              },
            ],
          },
        ],
      });

      // Lấy danh sách phim từ các vé đã đặt
      const movies = tickets
        .map((ticket) => ticket.screening?.movie)
        .filter((movie) => movie !== null && movie !== undefined);

      // Loại bỏ các phim trùng lặp
      const uniqueMovies: Movie[] = [];
      const movieIds = new Set();

      movies.forEach((movie) => {
        if (!movieIds.has(movie.id)) {
          movieIds.add(movie.id);
          uniqueMovies.push(movie);
        }
      });

      return uniqueMovies;
    } catch (error) {
      this.logger.error(
        `Error getting watched movies: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Lấy danh sách phim được đánh giá cao của người dùng
   */
  private async getHighlyRatedMovies(userId: number) {
    try {
      // Lấy danh sách đánh giá cao (>= 4 sao)
      const ratings = await this.movieRatingModel.findAll({
        where: {
          user_id: userId,
          rating: {
            [Op.gte]: 4, // Chỉ lấy các đánh giá từ 4 sao trở lên
          },
        },
      });

      return ratings;
    } catch (error) {
      this.logger.error(
        `Error getting highly rated movies: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Tính toán độ tương đồng giữa các phim
   * Phương thức này sẽ được gọi định kỳ để cập nhật bảng MovieSimilarity
   */
  async calculateMovieSimilarities() {
    try {
      this.logger.log('Calculating movie similarities...');

      // Lấy tất cả các phim
      const movies = await this.movieModel.findAll({
        include: [{ association: 'genres' }],
      });

      // Tạo transaction
      const transaction = await this.sequelize.transaction();

      try {
        // Xóa tất cả các bản ghi cũ
        await this.movieSimilarityModel.destroy({
          where: {},
          truncate: true,
          transaction,
        });

        // Tính toán độ tương đồng giữa các cặp phim
        const similarities: any[] = [];

        for (let i = 0; i < movies.length; i++) {
          for (let j = i + 1; j < movies.length; j++) {
            const movie1 = movies[i];
            const movie2 = movies[j];

            // Tính điểm tương đồng
            const similarityScore = this.calculateSimilarityScore(
              movie1,
              movie2,
            );
            const similarityFeatures = this.calculateSimilarityFeatures(
              movie1,
              movie2,
            );

            // Thêm vào danh sách
            similarities.push({
              movie_id_1: movie1.id,
              movie_id_2: movie2.id,
              similarity_score: similarityScore,
              similarity_features: similarityFeatures,
              similarity_type: 'content-based',
              calculated_at: new Date(),
            });

            // Thêm cặp ngược lại
            similarities.push({
              movie_id_1: movie2.id,
              movie_id_2: movie1.id,
              similarity_score: similarityScore,
              similarity_features: similarityFeatures,
              similarity_type: 'content-based',
              calculated_at: new Date(),
            });
          }
        }

        // Lưu vào cơ sở dữ liệu
        await this.movieSimilarityModel.bulkCreate(similarities, {
          transaction,
        });

        // Commit transaction
        await transaction.commit();

        this.logger.log(`Calculated similarities for ${movies.length} movies`);
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
   * Tính điểm tương đồng giữa hai phim
   */
  private calculateSimilarityScore(movie1: any, movie2: any): number {
    // Tính điểm tương đồng dựa trên các yếu tố khác nhau
    const genreSimilarity = this.calculateGenreSimilarity(movie1, movie2);
    const directorSimilarity = this.calculateDirectorSimilarity(movie1, movie2);
    const castSimilarity = this.calculateCastSimilarity(movie1, movie2);

    // Trọng số cho từng yếu tố
    const genreWeight = 0.5;
    const directorWeight = 0.3;
    const castWeight = 0.2;

    // Tính điểm tổng hợp
    const totalScore =
      genreSimilarity * genreWeight +
      directorSimilarity * directorWeight +
      castSimilarity * castWeight;

    return totalScore;
  }

  /**
   * Tính chi tiết tương đồng giữa hai phim
   */
  private calculateSimilarityFeatures(movie1: any, movie2: any): any {
    return {
      genre_similarity: this.calculateGenreSimilarity(movie1, movie2),
      director_similarity: this.calculateDirectorSimilarity(movie1, movie2),
      cast_similarity: this.calculateCastSimilarity(movie1, movie2),
    };
  }

  /**
   * Tính độ tương đồng về thể loại giữa hai phim
   */
  private calculateGenreSimilarity(movie1: any, movie2: any): number {
    const genres1 = movie1.genres.map((genre) => genre.id);
    const genres2 = movie2.genres.map((genre) => genre.id);

    // Tính số lượng thể loại chung
    const commonGenres = genres1.filter((genre) => genres2.includes(genre));

    // Tính độ tương đồng Jaccard
    const union = new Set([...genres1, ...genres2]);
    return commonGenres.length / union.size;
  }

  /**
   * Tính độ tương đồng về đạo diễn giữa hai phim
   */
  private calculateDirectorSimilarity(movie1: any, movie2: any): number {
    // Nếu cùng đạo diễn, điểm là 1, ngược lại là 0
    return movie1.director &&
      movie2.director &&
      movie1.director === movie2.director
      ? 1
      : 0;
  }

  /**
   * Tính độ tương đồng về diễn viên giữa hai phim
   */
  private calculateCastSimilarity(movie1: any, movie2: any): number {
    if (!movie1.cast || !movie2.cast) {
      return 0;
    }

    // Tách danh sách diễn viên
    const cast1 = movie1.cast.split(',').map((actor) => actor.trim());
    const cast2 = movie2.cast.split(',').map((actor) => actor.trim());

    // Tính số lượng diễn viên chung
    const commonCast = cast1.filter((actor) => cast2.includes(actor));

    // Tính độ tương đồng Jaccard
    const union = new Set([...cast1, ...cast2]);
    return commonCast.length / union.size;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { lastValueFrom } from 'rxjs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const stringSimilarity = require('string-similarity');
// import * as stringSimilarity from 'string-similarity';
import axios from 'axios';
// Models
import { Movie } from '../../../models/movie.model';
import { Screening } from '../../../models/screening.model';
import { Theater } from '../../../models/theater.model';
import { Genre } from '../../../models/genre.model';

@Injectable()
export class ContextAwareService {
  private readonly logger = new Logger(ContextAwareService.name);
  private readonly weatherApiKey: string;

  constructor(
    @InjectModel(Movie)
    private movieModel: typeof Movie,
    @InjectModel(Screening)
    private screeningModel: typeof Screening,
    @InjectModel(Theater)
    private theaterModel: typeof Theater,
    @InjectModel(Genre)
    private genreModel: typeof Genre,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly sequelize: Sequelize,
  ) {
    this.weatherApiKey = this.configService.get<string>('WEATHER_API_KEY', '');
  }

  /**
   * Lấy gợi ý dựa trên ngữ cảnh cho người dùng
   */
  async getRecommendations(userId: number) {
    try {
      // Kết hợp các gợi ý từ thời gian, vị trí và thời tiết
      const timeRecommendations = await this.getRecommendationsByTime();

      // Vì không có thông tin vị trí của người dùng, sử dụng vị trí mặc định
      const defaultLatitude = 10.7769; // Vị trí mặc định (TP.HCM)
      const defaultLongitude = 106.7009;

      const locationRecommendations = await this.getRecommendationsByLocation(
        defaultLatitude,
        defaultLongitude,
      );

      const weatherRecommendations = await this.getRecommendationsByWeather(
        defaultLatitude,
        defaultLongitude,
      );

      // Kết hợp các gợi ý và sắp xếp theo điểm số
      const allRecommendations = [
        ...timeRecommendations.map((rec) => ({
          ...rec,
          score: rec.score * 0.4,
        })), // Trọng số 0.4 cho thời gian
        ...locationRecommendations.map((rec) => ({
          ...rec,
          score: rec.score * 0.3,
        })), // Trọng số 0.3 cho vị trí
        ...weatherRecommendations.map((rec) => ({
          ...rec,
          score: rec.score * 0.3,
        })), // Trọng số 0.3 cho thời tiết
      ];

      // Gom nhóm theo movie_id và tính tổng điểm
      const movieMap: Map<number, any> = new Map();
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
          recommendation_type: 'context-aware',
          context_data: rec.context_data,
        }))
        .sort((a, b) => b.score - a.score);

      return combinedRecommendations;
    } catch (error) {
      this.logger.error(
        `Error getting context-aware recommendations: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Lấy gợi ý dựa trên thời gian hiện tại
   */
  async getRecommendationsByTime() {
    try {
      const now = new Date();
      const hour = now.getHours();

      const dayOfWeek = now.getDay(); // 0 = Chủ Nhật, 1-6 = Thứ 2-Thứ 7
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      console.log('check time', now.getHours(), now.getDay());
      // Xác định thời điểm trong ngày
      let timeOfDay;
      if (hour >= 5 && hour < 12) {
        timeOfDay = 'morning';
      } else if (hour >= 12 && hour < 17) {
        timeOfDay = 'afternoon';
      } else if (hour >= 17 && hour < 22) {
        timeOfDay = 'evening';
      } else {
        timeOfDay = 'night';
      }

      // Xác định thể loại phim phù hợp với thời điểm trong ngày
      let genreKeywords: string[] = [];
      let contextDescription = '';

      if (timeOfDay === 'morning') {
        genreKeywords = ['Hoạt hình', 'Gia đình', 'Tâm lý', 'Hài'];
        contextDescription = 'Phim phù hợp cho buổi sáng';
      } else if (timeOfDay === 'afternoon') {
        genreKeywords = ['Phiêu lưu', 'Hành động', 'Chính kịch', 'Lãng mạn'];
        contextDescription = 'Phim phù hợp cho buổi chiều';
      } else if (timeOfDay === 'evening') {
        if (isWeekend) {
          genreKeywords = ['Hài', 'Lãng mạn', 'Tâm lý', 'Gia đình'];
          contextDescription = 'Phim phù hợp cho buổi tối cuối tuần';
        } else {
          genreKeywords = ['Hồi hộp', 'Chính kịch', 'Tâm lý', 'Hành động'];
          contextDescription = 'Phim phù hợp cho buổi tối ngày thường';
        }
      } else {
        // night
        genreKeywords = ['Kinh dị', 'Hồi hộp', 'Chính kịch', 'Tâm lý'];
        contextDescription = 'Phim phù hợp cho đêm khuya';
      }

      // Lấy tất cả genres từ DB
      const allGenres = await this.genreModel.findAll();
      const allGenreNames = allGenres.map((g) => g.name.toLowerCase());

      // Log các từ khóa và tên thể loại trong DB
      console.log('genreKeywords:', genreKeywords);
      console.log('allGenreNames:', allGenreNames);

      // Fuzzy matching: tìm các genres có tên gần giống với các genreKeywords mong muốn
      let matchedGenreIds = new Set<number>();
      for (const keyword of genreKeywords) {
        const matches = stringSimilarity.findBestMatch(
          keyword.toLowerCase(),
          allGenreNames,
        );
        matches.ratings.forEach((r, idx) => {
          if (r.rating > 0.5) matchedGenreIds.add(allGenres[idx].id); // ngưỡng có thể điều chỉnh
        });
      }
      const genreIds = Array.from(matchedGenreIds);

      // Log các genreIds được nhận diện
      console.log('genreIds:', genreIds);

      if (genreIds.length === 0) {
        return [];
      }

      // Lấy các phim thuộc thể loại phù hợp
      const movies = await this.movieModel.findAll({
        include: [
          {
            model: Genre,
            as: 'genres',
            where: {
              id: genreIds,
            },
            required: true,
          },
        ],
        order: [['popularity', 'DESC']],
        limit: 10,
      });

      // Tạo danh sách gợi ý
      return movies.map((movie) => ({
        movie_id: movie.id,
        score: 0.8, // Điểm mặc định
        recommendation_type: 'context-aware',
        context_data: {
          time_of_day: timeOfDay,
          is_weekend: isWeekend,
          description: contextDescription,
        },
      }));
    } catch (error) {
      this.logger.error(
        `Error getting recommendations by time: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Lấy gợi ý dựa trên vị trí địa lý
   */
  async getRecommendationsByLocation(latitude: number, longitude: number) {
    try {
      // Tìm rạp gần nhất
      const nearestTheatersRaw = await this.theaterModel.findAll();
      // Tính khoảng cách thực tế (ORS) cho từng rạp
      const nearestTheaters = await Promise.all(
        nearestTheatersRaw.map(async (theater: any) => {
          let distance: number = 0;
          if (theater.latitude && theater.longitude) {
            const realDistance = await getRealDistanceORS(
              latitude,
              longitude,
              theater.latitude,
              theater.longitude,
            );
            if (typeof realDistance === 'number' && !isNaN(realDistance)) {
              distance = realDistance;
            }
          }
          if (!distance) {
            distance = this.calculateDistance(
              latitude,
              longitude,
              theater.latitude,
              theater.longitude,
            );
          }
          return { ...theater.toJSON(), distance };
        }),
      );
      // Sắp xếp và lấy 5 rạp gần nhất
      const sortedTheaters = nearestTheaters
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);
      if (sortedTheaters.length === 0) {
        return [];
      }
      // Lấy ID của các rạp gần nhất
      const theaterIds = sortedTheaters.map((theater) => theater.id);
      // Lấy các suất chiếu sắp tới tại các rạp gần nhất
      const now = new Date();
      const screeningsRaw = await this.screeningModel.findAll({
        where: {
          start_time: {
            [Op.gt]: now,
          },
        },
        include: [
          {
            model: this.sequelize.models.TheaterRoom,
            as: 'theaterRoom',
            include: [
              {
                model: this.sequelize.models.Theater,
                as: 'theater',
              },
            ],
          },
          { model: Movie, as: 'movie' },
        ],
        order: [['start_time', 'ASC']],
      });
      const screenings = screeningsRaw.filter((screening: any) => {
        const theater = screening.theaterRoom?.theater;
        return theater && sortedTheaters.some((t) => t.id === theater.id);
      });
      // Gom nhóm theo phim và tính điểm dựa trên số lượng suất chiếu và khoảng cách
      const movieScores = new Map();
      screenings.forEach((screening: any) => {
        const movie = screening.movie;
        const theater = screening.theaterRoom?.theater;
        // Tìm khoảng cách đến rạp
        const theaterInfo = sortedTheaters.find((t) => t.id === theater.id);
        const distance = theaterInfo
          ? Math.round(theaterInfo.distance * 100) / 100
          : 10;
        // Tính điểm dựa trên khoảng cách (càng gần càng cao)
        const distanceScore = 1 - Math.min(distance / 10, 1); // Chuẩn hóa về khoảng [0, 1]
        if (movieScores.has(movie.id)) {
          const current = movieScores.get(movie.id);
          movieScores.set(movie.id, {
            ...current,
            screeningCount: current.screeningCount + 1,
            totalDistanceScore: current.totalDistanceScore + distanceScore,
            theaters: current.theaters.includes(theater.id)
              ? current.theaters
              : [...current.theaters, theater.id],
          });
        } else {
          movieScores.set(movie.id, {
            movie_id: movie.id,
            screeningCount: 1,
            totalDistanceScore: distanceScore,
            theaters: [theater.id],
            nearestTheater: theater,
          });
        }
      });
      // Tính điểm tổng hợp và sắp xếp
      const recommendations = Array.from(movieScores.values())
        .map((item) => {
          // Tính điểm dựa trên số lượng suất chiếu và khoảng cách
          const screeningScore = Math.min(item.screeningCount / 5, 1); // Chuẩn hóa về khoảng [0, 1]
          const avgDistanceScore =
            item.totalDistanceScore / item.theaters.length;
          // Trọng số: 60% cho khoảng cách, 40% cho số lượng suất chiếu
          const score = avgDistanceScore * 0.6 + screeningScore * 0.4;
          // Lấy khoảng cách đến rạp gần nhất (làm tròn 2 chữ số)
          const theaterInfo = sortedTheaters.find(
            (t) => t.id === item.nearestTheater.id,
          );
          const distance = theaterInfo
            ? Math.round(theaterInfo.distance * 100) / 100
            : 10;
          return {
            movie_id: item.movie_id,
            score,
            recommendation_type: 'context-aware',
            distance, // khoảng cách đến rạp gần nhất (km)
            context_data: {
              nearest_theater: {
                id: item.nearestTheater.id,
                name: item.nearestTheater.name,
                address: item.nearestTheater.address,
              },
              screening_count: item.screeningCount,
              description: 'Phim đang chiếu tại rạp gần bạn',
            },
          };
        })
        .sort((a, b) => b.score - a.score);
      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error getting recommendations by location: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Lấy gợi ý dựa trên thời tiết hiện tại
   */
  async getRecommendationsByWeather(latitude: number, longitude: number) {
    try {
      // Lấy thông tin thời tiết
      const weatherInfo = await this.getWeatherInfo(latitude, longitude);

      if (!weatherInfo) {
        return [];
      }

      // Xác định từ khóa thể loại phim phù hợp với thời tiết (dùng tiếng Việt)
      let genreKeywords: string[] = [];
      let contextDescription = '';

      switch (weatherInfo.condition) {
        case 'rainy':
          genreKeywords = ['Tâm lý', 'Lãng mạn', 'Bí ẩn', 'Kinh dị'];
          contextDescription = 'Phim phù hợp cho ngày mưa';
          break;
        case 'sunny':
          genreKeywords = ['Phiêu lưu', 'Hài', 'Hành động', 'Gia đình'];
          contextDescription = 'Phim phù hợp cho ngày nắng';
          break;
        case 'cloudy':
          genreKeywords = [
            'Khoa học viễn tưởng',
            'Giả tưởng',
            'Bí ẩn',
            'Hồi hộp',
          ];
          contextDescription = 'Phim phù hợp cho ngày nhiều mây';
          break;
        case 'snowy':
          genreKeywords = ['Lãng mạn', 'Tâm lý', 'Giả tưởng', 'Gia đình'];
          contextDescription = 'Phim phù hợp cho ngày tuyết rơi';
          break;
        default:
          genreKeywords = [
            'Hài',
            'Hành động',
            'Phiêu lưu',
            'Khoa học viễn tưởng',
          ];
          contextDescription = 'Phim phù hợp với thời tiết hiện tại';
      }

      // Lấy tất cả genres từ DB
      const allGenres = await this.genreModel.findAll();
      const allGenreNames = allGenres.map((g) => g.name.toLowerCase());

      // Fuzzy matching: tìm các genres có tên gần giống với các genreKeywords mong muốn
      let matchedGenreIds = new Set<number>();
      for (const keyword of genreKeywords) {
        const matches = stringSimilarity.findBestMatch(
          keyword.toLowerCase(),
          allGenreNames,
        );
        matches.ratings.forEach((r, idx) => {
          if (r.rating > 0.5) matchedGenreIds.add(allGenres[idx].id); // ngưỡng có thể điều chỉnh
        });
      }
      const genreIds = Array.from(matchedGenreIds);

      if (genreIds.length === 0) {
        return [];
      }

      // Lấy các phim thuộc thể loại phù hợp (kèm genres)
      const movies = await this.movieModel.findAll({
        include: [
          {
            model: Genre,
            as: 'genres',
            where: {
              id: genreIds,
            },
            required: true,
            through: { attributes: [] },
          },
        ],
        order: [['popularity', 'DESC']],
        limit: 10,
      });

      // Tạo danh sách gợi ý với đầy đủ thông tin phim
      return movies.map((movie) => {
        const movieData = movie.toJSON();
        return {
          movie_id: movie.id,
          score: 0.8, // Điểm mặc định
          recommendation_type: 'context-aware',
          context_data: {
            weather: weatherInfo.condition,
            temperature: weatherInfo.temperature,
            description: contextDescription,
          },
          movie: {
            ...movieData,
            genres: movieData.genres
              ? movieData.genres.map((g: any) => ({ id: g.id, name: g.name }))
              : [],
          },
        };
      });
    } catch (error) {
      this.logger.error(
        `Error getting recommendations by weather: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Tìm các rạp gần nhất dựa trên vị trí địa lý
   */
  private async findNearestTheaters(latitude: number, longitude: number) {
    try {
      // Lấy tất cả các rạp
      const theaters = await this.theaterModel.findAll();

      // Tính khoảng cách đến từng rạp
      const theatersWithDistance = theaters.map((theater: any) => {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          theater.latitude,
          theater.longitude,
        );

        return {
          ...theater.toJSON(),
          distance,
        };
      });

      // Sắp xếp theo khoảng cách tăng dần và lấy 5 rạp gần nhất
      return theatersWithDistance
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);
    } catch (error) {
      this.logger.error(
        `Error finding nearest theaters: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Tính khoảng cách giữa hai điểm địa lý (theo km)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Bán kính Trái Đất (km)
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Khoảng cách (km)
    return distance;
  }

  /**
   * Chuyển đổi độ sang radian
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Lấy thông tin thời tiết từ API
   */
  private async getWeatherInfo(latitude: number, longitude: number) {
    try {
      if (!this.weatherApiKey) {
        // Nếu không có API key, trả về thông tin thời tiết giả lập
        return this.getMockWeatherInfo();
      }

      // Gọi API thời tiết
      const response = await lastValueFrom(
        this.httpService.get(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${this.weatherApiKey}&units=metric`,
        ),
      );

      const data = response.data;

      // Xác định điều kiện thời tiết
      let condition = 'clear';
      if (data.weather && data.weather.length > 0) {
        const weatherId = data.weather[0].id;
        if (weatherId >= 200 && weatherId < 600) {
          condition = 'rainy';
        } else if (weatherId >= 600 && weatherId < 700) {
          condition = 'snowy';
        } else if (weatherId >= 800 && weatherId < 900) {
          condition = 'sunny';
        } else {
          condition = 'cloudy';
        }
      }

      return {
        temperature: data.main.temp,
        condition,
        description: data.weather[0].description,
      };
    } catch (error) {
      this.logger.error(
        `Error getting weather info: ${error.message}`,
        error.stack,
      );
      // Nếu có lỗi, trả về thông tin thời tiết giả lập
      return this.getMockWeatherInfo();
    }
  }

  /**
   * Tạo thông tin thời tiết giả lập
   */
  private getMockWeatherInfo() {
    const conditions = ['rainy', 'sunny', 'cloudy', 'snowy'];
    const randomIndex = Math.floor(Math.random() * conditions.length);
    const condition = conditions[randomIndex];

    let temperature;
    switch (condition) {
      case 'rainy':
        temperature = 20 + Math.random() * 5; // 20-25°C
        break;
      case 'sunny':
        temperature = 25 + Math.random() * 10; // 25-35°C
        break;
      case 'cloudy':
        temperature = 18 + Math.random() * 7; // 18-25°C
        break;
      case 'snowy':
        temperature = -5 + Math.random() * 10; // -5-5°C
        break;
      default:
        temperature = 20 + Math.random() * 10; // 20-30°C
    }

    return {
      temperature,
      condition,
      description: `Simulated ${condition} weather`,
    };
  }
}

// Thêm hàm lấy khoảng cách thực tế bằng OpenRouteService
async function getRealDistanceORS(lat1, lon1, lat2, lon2) {
  try {
    const apiKey = process.env.ORS_API_KEY || '';
    if (!apiKey) return null;
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${lon1},${lat1}&end=${lon2},${lat2}`;
    const res = await axios.get(url);
    // Khoảng cách (mét)
    return res.data.features[0].properties.summary.distance / 1000; // km
  } catch (e) {
    return null;
  }
}

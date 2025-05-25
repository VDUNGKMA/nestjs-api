import { Controller, Get, Query } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { Public } from 'src/decorators/public-route.decorator';

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Public()
  // Gợi ý phim mới ra rạp (cho user chưa đăng nhập)
  @Get('new')
  async getNewMovies(@Query('topN') topN: number = 10) {
    return this.recommendationService.getNewMovies(topN);
  }
  @Public()
  // Gợi ý phim theo địa lý (giả lập, truyền location)
  @Get('by-location')
  async getMoviesByLocation(
    @Query('location') location: string,
    @Query('topN') topN: number = 10,
  ) {
    return this.recommendationService.getMoviesByLocation(location, topN);
  }

  // Gợi ý phim theo ngày, giờ
  @Public()
  @Get('by-time')
  async getMoviesByTime(@Query('topN') topN: number = 10) {
    return this.recommendationService.getMoviesByTime(topN);
  }

  // Gợi ý AI NCF (user đã đăng nhập)
  @Get()
  async getRecommendation(
    @Query('userId') userId: number,
    @Query('topN') topN: number = 10,
  ) {
    return this.recommendationService.getRecommendations(userId, topN);
  }

  // Gợi ý AI Wide&Deep (user đã đăng nhập)
  @Get('widedeep')
  async getWideDeepRecommendation(
    @Query('userId') userId: number,
    @Query('topN') topN: number = 10,
  ) {
    return this.recommendationService.getWideDeepRecommendations(userId, topN);
  }
  @Public()
  // Gợi ý phim theo ngày lễ
  @Get('by-holiday')
  async getMoviesByHoliday(@Query('topN') topN: number = 10) {
    return this.recommendationService.getMoviesByHoliday(topN);
  }
  @Public()
  // Gợi ý phim theo thời tiết
  @Get('by-weather')
  async getMoviesByWeather(
    @Query('location') location: string,
    @Query('topN') topN: number = 10,
  ) {
    return this.recommendationService.getMoviesByWeather(location, topN);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RecommendationService } from '../services/recommendation.service';
import { CreateRecommendationDto } from '../dto/create-recommendation.dto';
import { JwtAuthGuard } from 'src/modules/auth/passport/jwt-auth.guard';
import { ContentBasedService } from '../services/content-based.service';
import { ModelTrainingService } from '../services/model-training.service';

@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly contentBasedService: ContentBasedService,
    private readonly modelTrainingService: ModelTrainingService,
  ) {}

  @Get('personal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy gợi ý cá nhân cho người dùng đã đăng nhập' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách phim được gợi ý' })
  async getPersonalRecommendations(@Request() req) {
    const userId = req.user.userId;
    console.log('userId', req.user.userId);
    return this.recommendationService.getPersonalRecommendations(userId);
  }

  @Get('widedeep')
  @ApiOperation({ summary: 'Lấy gợi ý sử dụng mô hình Wide & Deep Learning' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách phim được gợi ý' })
  async getWideDeepRecommendations(@Query('userId') userId: number) {
    return this.recommendationService.getWideDeepRecommendations(userId);
  }

  @Get('by-time')
  @ApiOperation({ summary: 'Lấy gợi ý dựa trên thời gian hiện tại' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách phim được gợi ý' })
  async getRecommendationsByTime() {
    return this.recommendationService.getRecommendationsByTime();
  }

  @Get('by-location')
  @ApiOperation({ summary: 'Lấy gợi ý dựa trên vị trí địa lý' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách phim được gợi ý' })
  async getRecommendationsByLocation(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
  ) {
    return this.recommendationService.getRecommendationsByLocation(
      latitude,
      longitude,
    );
  }

  @Get('by-weather')
  @ApiOperation({ summary: 'Lấy gợi ý dựa trên thời tiết hiện tại' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách phim được gợi ý' })
  async getRecommendationsByWeather(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
  ) {
    return this.recommendationService.getRecommendationsByWeather(
      latitude,
      longitude,
    );
  }

  @Get('similar/:movieId')
  @ApiOperation({ summary: 'Lấy các phim tương tự với phim đã cho' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách phim tương tự' })
  async getSimilarMovies(@Param('movieId') movieId: number) {
    return this.recommendationService.getSimilarMovies(movieId);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Lấy các phim đang thịnh hành' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách phim thịnh hành' })
  async getTrendingMovies() {
    return this.recommendationService.getTrendingMovies();
  }

  @Get('new')
  @ApiOperation({ summary: 'Lấy các phim mới' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách phim mới' })
  async getNewMovies() {
    return this.recommendationService.getNewMovies();
  }

  @Post('feedback')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi phản hồi về gợi ý' })
  @ApiResponse({ status: 201, description: 'Phản hồi đã được ghi nhận' })
  async provideFeedback(
    @Request() req,
    @Body() createRecommendationDto: CreateRecommendationDto,
  ) {
    const userId = req.user.userId;
    console.log('check userId', userId);
    return this.recommendationService.recordRecommendationFeedback(
      userId,
      createRecommendationDto,
    );
  }

  @Get('user-preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin sở thích của người dùng' })
  @ApiResponse({ status: 200, description: 'Trả về thông tin sở thích' })
  async getUserPreferences(@Request() req) {
    const userId = req.user.userId;
    return this.recommendationService.getUserPreferences(userId);
  }

  @Post('user-preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật sở thích của người dùng' })
  @ApiResponse({ status: 200, description: 'Sở thích đã được cập nhật' })
  async updateUserPreferences(@Request() req, @Body() preferences: any) {
    const userId = req.user.userId;
    return this.recommendationService.updateUserPreferences(
      userId,
      preferences,
    );
  }

  @Get('admin/calculate-movie-similarities')
  @ApiOperation({
    summary:
      '[ADMIN] Tính toán lại độ tương đồng giữa các phim (content-based)',
  })
  @ApiResponse({
    status: 200,
    description: 'Đã tính toán xong độ tương đồng giữa các phim',
  })
  async calculateMovieSimilarities() {
    try {
      await this.contentBasedService.calculateMovieSimilarities();
      return {
        message:
          'Đã tính toán xong độ tương đồng giữa các phim (content-based)!',
      };
    } catch (error) {
      return {
        message: 'Có lỗi khi tính toán độ tương đồng',
        error: error.message,
      };
    }
  }

  @Post('admin/train-all-models')
  @ApiOperation({
    summary: '[ADMIN] Train tất cả các model gợi ý ngay lập tức',
  })
  async trainAllModelsNow() {
    // Train content-based
    await this.modelTrainingService.trainContentBasedModel();
    // Train collaborative filtering
    await this.modelTrainingService.trainCollaborativeFilteringModel();
    // Train wide & deep
    await this.modelTrainingService.trainWideAndDeepModel();
    // Train personal recommendations
    await this.modelTrainingService.trainPersonalRecommendations();
    return { message: 'Đã train tất cả các model gợi ý xong!' };
  }
}

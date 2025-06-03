import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  ParseIntPipe, // Thêm ParseIntPipe
  Query,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { MoviesService } from './movie.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Movie } from 'src/models/movie.model';
import { Roles } from 'src/decorators/role.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Public } from 'src/decorators/public-route.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { MovieRating } from '../../models/movie-rating.model';
import { MovieComment } from '../../models/movie-comment.model';
import { Sequelize } from 'sequelize-typescript';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';

@Controller('movies')
export class MovieController {
  constructor(
    private readonly movieService: MoviesService,
    private readonly sequelize: Sequelize,
  ) {}

  // Special endpoints first
  @Public()
  @Get('popular')
  async getPopularMovies(): Promise<Movie[]> {
    return this.movieService.findAll({ popular: true });
  }
  @Public()
  @Get('upcoming')
  async getUpcomingMovies(): Promise<Movie[]> {
    return this.movieService.findAll({ upcoming: true });
  }
  @Public()
  @Get('now-playing')
  async getNowPlayingMovies(): Promise<Movie[]> {
    // Trả về tất cả phim đã phát hành, không yêu cầu phải có suất chiếu trong ngày hôm nay
    return this.movieService.findAll({ nowPlaying: true });
  }
  // @Public()
  // @Get('top-rated')
  // async getTopRatedMovies(): Promise<Movie[]> {
  //   return this.movieService.findAll({ topRated: true });
  // }

  @Public()
  @Get('currently-showing')
  async getCurrentlyShowingMovies(
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ): Promise<Movie[]> {
    return this.movieService.getShowingMovies(days || 14);
  }

  @Public()
  @Get('top-rated-list')
  async getTopRatedList(): Promise<Movie[]> {
    return this.movieService.getTopRatedMovies();
  }

  @Public()
  @Get('top-popular')
  async getTopPopularMovies(): Promise<Movie[]> {
    return this.movieService.getTopPopularMovies();
  }

  // Regular endpoints
  @Post()
  async create(@Body() createMovieDto: CreateMovieDto): Promise<Movie> {
    return this.movieService.createMovie(createMovieDto);
  }
  @Public()
  @Get()
  async findAll(@Query() query): Promise<Movie[]> {
    return this.movieService.findAll(query);
  }
  @Public()
  @Get('statistics')
  async getStatistics() {
    return this.movieService.getStatistics();
  }
  @Public()
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Movie> {
    return this.movieService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMovieDto: UpdateMovieDto,
  ): Promise<Movie> {
    return this.movieService.updateMovie(id, updateMovieDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.movieService.deleteMovie(id);
  }
  // Upload endpoints for admin
  @Post(':id/upload-poster')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @UseInterceptors(
    FileInterceptor('poster', {
      storage: diskStorage({
        destination: './uploads/posters',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `poster-${req.params.id}-${uniqueSuffix}${ext}`;
          cb(null, filename);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadPoster(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Movie> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.movieService.updateMoviePoster(id, file);
  }

  @Post(':id/upload-trailer')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @UseInterceptors(
    FileInterceptor('trailer', {
      storage: diskStorage({
        destination: './uploads/trailers',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `trailer-${req.params.id}-${uniqueSuffix}${ext}`;
          cb(null, filename);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(mp4|mov|avi|mkv)$/)) {
          return cb(
            new BadRequestException('Only video files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    }),
  )
  async uploadTrailer(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Movie> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.movieService.updateMovieTrailer(id, file);
  }

  @Post(':movieId/rate')
  async rateMovie(
    @Param('movieId') movieId: number,
    @Body() body: { user_id: number; rating: number; comment?: string },
  ) {
    return this.movieService.rateMovie(
      movieId,
      body.user_id,
      body.rating,
      body.comment,
    );
  }
  @Public()
  @Get(':movieId/average-rating')
  async getAverageRating(@Param('movieId') movieId: number) {
    return this.movieService.getAverageRating(movieId);
  }

  @Public()
  @Get(':movieId/ratings')
  async getRatings(@Param('movieId') movieId: number) {
    return this.movieService.getRatings(movieId);
  }

  // Tạo comment hoặc reply cho phim
  @UseGuards(JwtAuthGuard)
  @Post(':movieId/comments')
  async createComment(
    @Param('movieId') movieId: number,
    @Body('content') content: string,
    @Body('parent_id') parent_id: number,
    @Req() req,
  ) {
    const userId = req.user.id || req.user.userId;
    const data: any = {
      movie_id: movieId,
      user_id: userId,
      content,
    };
    if (typeof parent_id === 'number' && !isNaN(parent_id)) {
      data.parent_id = parent_id;
    }
    const comment = await MovieComment.create(data);
    return comment;
  }

  // Lấy danh sách comment dạng cây cho phim
  @Public()
  @Get(':movieId/comments')
  async getComments(@Param('movieId') movieId: number) {
    // Lấy tất cả comment của phim
    const comments = await MovieComment.findAll({
      where: { movie_id: movieId },
      order: [['created_at', 'ASC']],
      include: [
        { model: MovieComment, as: 'replies' },
        { model: MovieComment, as: 'parent' },
      ],
    });
    // Chuyển thành dạng cây
    const map: { [key: number]: any } = {};
    const roots: any[] = [];
    comments.forEach((c) => {
      map[c.id] = { ...c.toJSON(), replies: [] };
    });
    comments.forEach((c) => {
      if (c.parent_id) {
        map[c.parent_id]?.replies.push(map[c.id]);
      } else {
        roots.push(map[c.id]);
      }
    });
    return roots;
  }

  // Xóa comment (và các reply con)
  @UseGuards(JwtAuthGuard)
  @Delete('comments/:commentId')
  async deleteComment(@Param('commentId') commentId: number, @Req() req) {
    const userId = req.user.id || req.user.userId;
    const comment = await MovieComment.findByPk(commentId);
    if (!comment) return { message: 'Comment not found' };
    if (comment.user_id !== userId) return { message: 'Không có quyền xóa' };
    // Xóa tất cả reply con (đệ quy nếu cần)
    await this.deleteCommentRecursive(commentId);
    return { message: 'Đã xóa comment và các reply con' };
  }

  // Hàm đệ quy xóa comment và reply con
  private async deleteCommentRecursive(commentId: number) {
    const replies = await MovieComment.findAll({
      where: { parent_id: commentId },
    });
    for (const reply of replies) {
      await this.deleteCommentRecursive(reply.id);
    }
    await MovieComment.destroy({ where: { id: commentId } });
  }

  @UseGuards(JwtAuthGuard)
  @Put('comments/:commentId')
  async updateComment(
    @Param('commentId') commentId: number,
    @Body('content') content: string,
    @Req() req,
  ) {
    const userId = req.user.id || req.user.userId;
    const comment = await MovieComment.findByPk(commentId);
    if (!comment) return { message: 'Comment not found' };
    if (comment.user_id !== userId) return { message: 'Không có quyền sửa' };
    comment.content = content;
    await comment.save();
    return comment;
  }
}

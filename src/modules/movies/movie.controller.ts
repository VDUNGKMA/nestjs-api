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
} from '@nestjs/common';
import { MoviesService } from './movie.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Movie } from 'src/models/movie.model';
import { Roles } from 'src/decorators/role.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Public } from 'src/decorators/public-route.decorator';

@Controller('movies')
export class MovieController {
  constructor(private readonly movieService: MoviesService) {}

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
    return this.movieService.findAll({ nowPlaying: true });
  }
  @Public()
  @Get('top-rated')
  async getTopRatedMovies(): Promise<Movie[]> {
    return this.movieService.findAll({ topRated: true });
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
}

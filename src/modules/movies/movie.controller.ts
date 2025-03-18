import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  ParseIntPipe, // Thêm ParseIntPipe
} from '@nestjs/common';
import { MoviesService } from './movie.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Movie } from 'src/models/movie.model';
import { Roles } from 'src/decorators/role.decorator';
import { RolesGuard } from 'src/guards/roles.guard';

@UseGuards(RolesGuard)
@Roles('admin')
@Controller('movies')
export class MovieController {
  constructor(private readonly movieService: MoviesService) {}

  // Endpoint tạo phim - chỉ admin
  @Post()
  async create(@Body() createMovieDto: CreateMovieDto): Promise<Movie> {
    return this.movieService.createMovie(createMovieDto);
  }

  // Endpoint lấy danh sách phim - public (không cần Roles nếu muốn public)
  @Get()
  async findAll(): Promise<Movie[]> {
    return this.movieService.findAll();
  }

  // Endpoint lấy chi tiết phim theo ID - public (không cần Roles nếu muốn public)
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number, // Chuyển string thành number
  ): Promise<Movie> {
    return this.movieService.findOne(id);
  }

  // Endpoint cập nhật phim - chỉ admin
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number, // Chuyển string thành number
    @Body() updateMovieDto: UpdateMovieDto,
  ): Promise<Movie> {
    return this.movieService.updateMovie(id, updateMovieDto);
  }

  // Endpoint xóa phim - chỉ admin
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number, // Chuyển string thành number
  ): Promise<void> {
    return this.movieService.deleteMovie(id);
  }
}

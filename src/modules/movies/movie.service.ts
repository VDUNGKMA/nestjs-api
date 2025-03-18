// import { Injectable, NotFoundException } from '@nestjs/common';
// import { InjectModel } from '@nestjs/sequelize';
// import { Movie } from '../../models/movie.model';
// import { CreateMovieDto } from './dto/create-movie.dto';
// import { UpdateMovieDto } from './dto/update-movie.dto';

// @Injectable()
// export class MoviesService {
//   constructor(@InjectModel(Movie) private movieModel: typeof Movie) {}

//   async createMovie(createMovieDto: CreateMovieDto): Promise<Movie> {
//     const data = {
//       ...createMovieDto,
//       cast: createMovieDto.cast
//         ? createMovieDto.cast.join(', ')
//         : createMovieDto.cast,
//     };

//     const movie = this.movieModel.build(data);
//     return movie.save();
//   }

//   async findAll(): Promise<Movie[]> {
//     return this.movieModel.findAll();
//   }

//   async findOne(id: number): Promise<Movie> {
//     const movie = await this.movieModel.findByPk(id);
//     if (!movie) {
//       throw new NotFoundException('Movie not found');
//     }
//     return movie;
//   }

//   async updateMovie(
//     id: number,
//     updateMovieDto: UpdateMovieDto,
//   ): Promise<Movie> {
//     const movie = await this.findOne(id);

//     // Nếu `cast` là mảng, chuyển nó thành chuỗi, nếu không thì giữ nguyên giá trị
//     if (updateMovieDto.cast && Array.isArray(updateMovieDto.cast)) {
//       updateMovieDto.cast = updateMovieDto.cast.join(', ');
//     }

//     // Cập nhật thông tin phim
//     await movie.update(updateMovieDto as any);
//     return movie;
//   }

//   async deleteMovie(id: number): Promise<void> {
//     const movie = await this.findOne(id);
//     await movie.destroy();
//   }
// }
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Movie } from '../../models/movie.model';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Genre } from '../../models/genre.model';
import { MovieGenre } from '../../models/movie-genre.model';
import { Attributes } from 'sequelize';

@Injectable()
export class MoviesService {
  constructor(
    @InjectModel(Movie) private movieModel: typeof Movie,
    @InjectModel(MovieGenre) private movieGenreModel: typeof MovieGenre,
  ) {}

  async createMovie(createMovieDto: CreateMovieDto): Promise<Movie> {
    const { genreIds, ...movieData } = createMovieDto;
    const data = {
      ...movieData,
      cast: movieData.cast ? movieData.cast.join(', ') : movieData.cast,
    };

    // Tạo phim
    const movie = await this.movieModel.create(data);
    // Liên kết với các thể loại nếu có genreIds
    if (genreIds && genreIds.length > 0) {
      const movieGenres = genreIds.map((genreId) => ({
        movie_id: movie.id,
        genre_id: genreId,
      }));
   
      await this.movieGenreModel.bulkCreate(movieGenres as MovieGenre[]);
    }
    const result = await this.findOne(movie.id);
    return result;
  }

  async findAll(): Promise<Movie[]> {
    return this.movieModel.findAll({
      include: [
        {
          model: Genre,
          through: { attributes: [] },
          as: 'genres',
        },
      ],
    });
  }

  async findOne(id: number): Promise<Movie> {
    const movie = await this.movieModel.findByPk(id, {
      include: [
        {
          model: Genre,
          through: { attributes: [] },
          as: 'genres',
        },
      ],
    });
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }
    return movie;
  }

  async updateMovie(
    id: number,
    updateMovieDto: UpdateMovieDto,
  ): Promise<Movie> {
    const movie = await this.findOne(id);
    const { genreIds, ...movieData } = updateMovieDto;

    // Cập nhật thông tin phim
    if (movieData.cast && Array.isArray(movieData.cast)) {
      movieData.cast = movieData.cast.join(', ');
    }
    await movie.update(movieData as any);

    // Cập nhật thể loại nếu có genreIds
    if (genreIds !== undefined) {
      await this.movieGenreModel.destroy({ where: { movie_id: id } });
      if (genreIds.length > 0) {
        const movieGenres = genreIds.map((genreId) => ({
          movie_id: id,
          genre_id: genreId,
        }));
        await this.movieGenreModel.bulkCreate(movieGenres as MovieGenre[]);
      }
    }

    return this.findOne(id);
  }

  async deleteMovie(id: number): Promise<void> {
    const movie = await this.findOne(id);
    await this.movieGenreModel.destroy({ where: { movie_id: id } });
    await movie.destroy();
  }
}
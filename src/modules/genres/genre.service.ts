import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Genre } from '../../models/genre.model';
import { CreateGenreDto, UpdateGenreDto } from './dto/genre.dto';
import { Movie } from 'src/models/movie.model';
import { Op } from 'sequelize';

@Injectable()
export class GenreService {
  constructor(@InjectModel(Genre) private genreModel: typeof Genre) {}

  async create(createGenreDto: CreateGenreDto): Promise<Genre> {
     const existingGenre = await this.genreModel.findOne({
       where: { name: createGenreDto.name },
     });

     if (existingGenre) {
       throw new ConflictException(
         `Genre with name "${createGenreDto.name}" already exists`,
       );
     }
    return this.genreModel.create(createGenreDto);
  }

  async findAll(): Promise<Genre[]> {
    return this.genreModel.findAll({
      include: [
        {
          model: Movie,
          through: { attributes: [] },
          as: 'movies', // Kiểm tra alias
        },
      ],
    });
  }

  async findOne(id: number): Promise<Genre> {
    const genre = await this.genreModel.findByPk(id, {
      include: { all: true },
    });
    if (!genre) throw new NotFoundException(`Genre with ID ${id} not found`);
    return genre;
  }

  async update(id: number, updateGenreDto: UpdateGenreDto): Promise<Genre> {
    const genre = await this.findOne(id);
    console.log("check genre", updateGenreDto.name);
     if (updateGenreDto.name) {
       const existingGenre = await this.genreModel.findOne({
         where: { name: updateGenreDto.name, id: { [Op.ne]: id } }, // Không trùng với chính nó
       });
       console.log("check ext", existingGenre);
       if (existingGenre) {
         throw new ConflictException(
           `Genre with name "${UpdateGenreDto.name}" already exists`,
         );
       }
     }
    await genre.update(updateGenreDto);
    return genre;
  }

  async remove(id: number): Promise<void> {
    const genre = await this.findOne(id);
    await genre.destroy();
  }
}

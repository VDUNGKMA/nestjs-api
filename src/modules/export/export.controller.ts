import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../../models/user.model';
import { Movie } from '../../models/movie.model';
import { Ticket } from '../../models/ticket.model';
import { Screening } from '../../models/screening.model';
import { Genre } from '../../models/genre.model';
import { Public } from 'src/decorators/public-route.decorator';

@Controller('export')
export class ExportController {
  constructor(
    @InjectModel(User) private userModel: typeof User,
    @InjectModel(Movie) private movieModel: typeof Movie,
    @InjectModel(Ticket) private ticketModel: typeof Ticket,
    @InjectModel(Screening) private screeningModel: typeof Screening,
    @InjectModel(Genre) private genreModel: typeof Genre,
  ) {}

  @Public()
  @Get('all')
  async exportAll() {
    // Export users
    const users = await this.userModel.findAll({
      attributes: ['id', 'name', 'email', 'role'],
      raw: true,
    });

    // Export movies (kèm genres)
    const movies = await this.movieModel.findAll({
      attributes: ['id', 'title', 'release_date', 'rating', 'popularity'],
      include: [
        {
          model: Genre,
          attributes: ['id', 'name'],
          through: { attributes: [] },
        },
      ],
    });

    // Export tickets (booking) + mapping movie_id
    const tickets = await this.ticketModel.findAll({
      attributes: ['id', 'user_id', 'screening_id', 'booking_time'],
      include: [
        {
          model: Screening,
          attributes: ['movie_id'],
        },
      ],
      raw: true,
      nest: true,
    });

    // Chuyển tickets thành {id, user_id, movie_id, booking_time}
    const bookings = tickets.map((t) => ({
      id: t.id,
      user_id: t.user_id,
      movie_id: t.screening.movie_id,
      booking_time: t.booking_time,
    }));

    // Chuẩn hóa genres cho movie
    const moviesData = movies.map((m: any) => ({
      id: m.id,
      title: m.title,
      release_date: m.release_date,
      rating: m.rating,
      popularity: m.popularity,
      genres: m.genres?.map((g) => ({ id: g.id, name: g.name })) || [],
    }));

    return {
      users,
      movies: moviesData,
      bookings,
    };
  }
}

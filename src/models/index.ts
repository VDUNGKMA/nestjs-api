import { User } from './user.model';
import { Movie } from './movie.model';
import { Theater } from './theater.model';
import { TheaterRoom } from './theater-room.model';
import { Screening } from './screening.model';
import { Seat } from './seat.model';
import { Ticket } from './ticket.model';
import { Payment } from './payment.model';
import { QR_Code } from './qr-code.model';
import { MovieGenre } from './movie-genre.model';
import { Genre } from './genre.model';
import { RefreshToken } from './refresh-token.model';
import { SeatReservation } from './seat-reservation.model';
import { FoodDrink } from './food-drink.model';
import { TicketFoodDrink } from './ticket-food-drink.model';
import { TicketSeat } from './ticket-seat.model';
import { MovieRating } from './movie-rating.model';

export const models = [
  User,
  Movie,
  Genre,
  MovieGenre,
  Theater,
  TheaterRoom,
  Screening,
  Seat, // Nếu sử dụng
  Ticket,
  Payment,
  QR_Code,
  RefreshToken,
  SeatReservation,
  FoodDrink,
  TicketFoodDrink,
  TicketSeat,
  MovieRating,
];

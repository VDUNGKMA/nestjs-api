import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PaymentService } from './payments.service';
import { PaymentController } from './payments.controller';
import { Payment } from '../../models/payment.model';
import { Ticket } from '../../models/ticket.model';
import { User } from '../../models/user.model';
import { SeatReservation } from '../../models/seat-reservation.model';
import { FoodDrink } from '../../models/food-drink.model';
import { TicketFoodDrink } from '../../models/ticket-food-drink.model';
import { FoodDrinksModule } from '../food-drinks/food-drinks.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Payment,
      Ticket,
      User,
      SeatReservation,
      FoodDrink,
      TicketFoodDrink,
    ]),
    forwardRef(() => FoodDrinksModule),
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService, SequelizeModule],
})
export class PaymentModule {}

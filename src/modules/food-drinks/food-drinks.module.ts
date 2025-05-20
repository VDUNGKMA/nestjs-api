import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FoodDrinksController } from './food-drinks.controller';
import { FoodDrinksService } from './food-drinks.service';
import { FoodDrink } from '../../models/food-drink.model';
import { TicketFoodDrink } from '../../models/ticket-food-drink.model';
import { Ticket } from '../../models/ticket.model';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../guards/roles.guard';

@Module({
  imports: [
    SequelizeModule.forFeature([FoodDrink, TicketFoodDrink, Ticket]),
    forwardRef(() => AuthModule),
  ],
  controllers: [FoodDrinksController],
  providers: [FoodDrinksService, JwtAuthGuard, RolesGuard],
  exports: [FoodDrinksService, SequelizeModule],
})
export class FoodDrinksModule {}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FoodDrink } from '../../models/food-drink.model';
import { TicketFoodDrink } from '../../models/ticket-food-drink.model';
import { Ticket } from '../../models/ticket.model';
import { CreateFoodDrinkDto } from './dto/create-food-drink.dto';
import { UpdateFoodDrinkDto } from './dto/update-food-drink.dto';
import { OrderFoodDrinkDto } from './dto/order-food-drink.dto';
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class FoodDrinksService {
  constructor(
    @InjectModel(FoodDrink)
    private foodDrinkModel: typeof FoodDrink,

    @InjectModel(TicketFoodDrink)
    private ticketFoodDrinkModel: typeof TicketFoodDrink,

    @InjectModel(Ticket)
    private ticketModel: typeof Ticket,

    private sequelize: Sequelize,
  ) {}

  async findAll(category?: 'food' | 'drink' | 'combo') {
    const query: any = { where: { is_available: true } };

    if (category) {
      query.where.category = category;
    }

    return this.foodDrinkModel.findAll(query);
  }

  async findOne(id: number) {
    const foodDrink = await this.foodDrinkModel.findByPk(id);

    if (!foodDrink) {
      throw new NotFoundException(`Food/Drink item with ID ${id} not found`);
    }

    return foodDrink;
  }

  async create(createFoodDrinkDto: CreateFoodDrinkDto) {
    // Ensure is_available has a default value if not provided
    const dtoWithDefaults = {
      ...createFoodDrinkDto,
      is_available: createFoodDrinkDto.is_available ?? true,
    };
    return this.foodDrinkModel.create(dtoWithDefaults);
  }

  async update(id: number, updateFoodDrinkDto: UpdateFoodDrinkDto) {
    const foodDrink = await this.findOne(id);
    await foodDrink.update(updateFoodDrinkDto);
    return foodDrink;
  }

  async remove(id: number) {
    const foodDrink = await this.findOne(id);
    await foodDrink.destroy();
    return { success: true, message: 'Food/Drink item deleted successfully' };
  }

  async orderFoodDrinks(orderDto: OrderFoodDrinkDto) {
    // Start a transaction to ensure all operations succeed or fail together
    const transaction = await this.sequelize.transaction();

    try {
      // Verify ticket exists
      const ticket = await this.ticketModel.findByPk(orderDto.ticket_id);
      if (!ticket) {
        throw new NotFoundException(
          `Ticket ID ${orderDto.ticket_id} not found`,
        );
      }

      // Process each item
      const orderItems: TicketFoodDrink[] = [];

      for (const item of orderDto.items) {
        // Find food/drink and verify it's available
        const foodDrink = await this.foodDrinkModel.findByPk(
          item.food_drink_id,
          { transaction },
        );

        if (!foodDrink) {
          throw new NotFoundException(
            `Food/Drink ID ${item.food_drink_id} not found`,
          );
        }

        if (!foodDrink.is_available) {
          throw new BadRequestException(
            `Food/Drink "${foodDrink.name}" is not available`,
          );
        }

        // Check stock if applicable
        if (
          foodDrink.stock_quantity !== null &&
          foodDrink.stock_quantity < item.quantity
        ) {
          throw new BadRequestException(
            `Not enough stock for "${foodDrink.name}". Available: ${foodDrink.stock_quantity}, Requested: ${item.quantity}`,
          );
        }

        // Calculate total price for this item
        const itemTotal = foodDrink.price * item.quantity;
        
        // Create order item
        const orderItem = await this.ticketFoodDrinkModel.create(
          {
            ticket_id: orderDto.ticket_id,
            food_drink_id: item.food_drink_id,
            quantity: item.quantity,
            unit_price: foodDrink.price,
            total_price: itemTotal,
            status: 'pending',
          },
          { transaction },
        );

        // Update stock if applicable
        if (foodDrink.stock_quantity !== null) {
          await foodDrink.update(
            {
              stock_quantity: foodDrink.stock_quantity - item.quantity,
            },
            { transaction },
          );
        }

        orderItems.push(orderItem);
      }

      // Commit transaction
      await transaction.commit();

      return {
        success: true,
        message: 'Food/Drink order processed successfully',
        items: orderItems,
      };
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }

  async getTicketFoodDrinks(ticketId: number) {
    const items = await this.ticketFoodDrinkModel.findAll({
      where: { ticket_id: ticketId },
      include: [FoodDrink],
    });

    if (!items || items.length === 0) {
      return { items: [], total: 0 };
    }

    const total = items.reduce((sum, item) => {
      return sum + item.unit_price * item.quantity;
    }, 0);

    return { items, total };
  }

  async updateOrderStatus(
    id: number,
    status: 'pending' | 'ready' | 'delivered' | 'cancelled',
  ) {
    const item = await this.ticketFoodDrinkModel.findByPk(id);

    if (!item) {
      throw new NotFoundException(`Order item with ID ${id} not found`);
    }

    await item.update({ status });
    return item;

  }
  
}

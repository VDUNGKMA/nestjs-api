import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FoodDrinksService } from './food-drinks.service';
import { CreateFoodDrinkDto } from './dto/create-food-drink.dto';
import { UpdateFoodDrinkDto } from './dto/update-food-drink.dto';
import { OrderFoodDrinkDto } from './dto/order-food-drink.dto';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Public } from 'src/decorators/public-route.decorator';
import { Roles } from 'src/decorators/role.decorator';


@ApiTags('food-drinks')
@Controller('food-drinks')
export class FoodDrinksController {
  constructor(private readonly foodDrinksService: FoodDrinksService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all available food and drinks' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['food', 'drink', 'combo'],
  })
  @ApiResponse({
    status: 200,
    description: 'Return all available food and drinks',
  })
  async findAll(@Query('category') category?: 'food' | 'drink' | 'combo') {
    return this.foodDrinksService.findAll(category);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get food/drink by ID' })
  @ApiParam({ name: 'id', description: 'Food/Drink ID' })
  @ApiResponse({ status: 200, description: 'Return the food/drink item' })
  @ApiResponse({ status: 404, description: 'Food/Drink not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.foodDrinksService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new food/drink item' })
  @ApiResponse({ status: 201, description: 'The food/drink has been created' })
  async create(@Body() createFoodDrinkDto: CreateFoodDrinkDto) {
    return this.foodDrinksService.create(createFoodDrinkDto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update a food/drink item' })
  @ApiParam({ name: 'id', description: 'Food/Drink ID' })
  @ApiResponse({ status: 200, description: 'The food/drink has been updated' })
  @ApiResponse({ status: 404, description: 'Food/Drink not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFoodDrinkDto: UpdateFoodDrinkDto,
  ) {
    return this.foodDrinksService.update(id, updateFoodDrinkDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a food/drink item' })
  @ApiParam({ name: 'id', description: 'Food/Drink ID' })
  @ApiResponse({ status: 200, description: 'The food/drink has been deleted' })
  @ApiResponse({ status: 404, description: 'Food/Drink not found' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.foodDrinksService.remove(id);
  }

  @Post('order')
  @ApiOperation({ summary: 'Order food/drinks for a ticket' })
  @ApiResponse({ status: 201, description: 'The order has been created' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'Ticket or food/drink not found' })
  async orderFoodDrinks(@Body() orderDto: OrderFoodDrinkDto) {
    return this.foodDrinksService.orderFoodDrinks(orderDto);
  }

  @Get('ticket/:ticketId')
  @ApiOperation({ summary: 'Get food/drinks ordered for a ticket' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiResponse({
    status: 200,
    description: 'Return the food/drinks for the ticket',
  })
  async getTicketFoodDrinks(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.foodDrinksService.getTicketFoodDrinks(ticketId);
  }

  @Put('order/:id/status')
  @UseGuards(RolesGuard)
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', description: 'Order item ID' })
  @ApiResponse({
    status: 200,
    description: 'The order status has been updated',
  })
  @ApiResponse({ status: 404, description: 'Order item not found' })
  async updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: 'pending' | 'ready' | 'delivered' | 'cancelled',
  ) {
    return this.foodDrinksService.updateOrderStatus(id, status);
  }
}

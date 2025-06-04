import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TicketService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateMultipleSeatsTicketDto } from './dto/create-multiple-seats-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VerifyQRDto } from './dto/verify-qr.dto';

@ApiTags('tickets')
@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo một vé với một ghế' })
  create(@Body() createTicketDto: CreateTicketDto) {
    return this.ticketService.create(createTicketDto);
  }

  @Post('multiple-seats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo một vé với nhiều ghế và đồ ăn/đồ uống (tùy chọn)',
  })
  @ApiResponse({ status: 201, description: 'Vé được tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  createWithMultipleSeats(
    @Req() req,
    @Body() data: CreateMultipleSeatsTicketDto,
  ) {
    const userId = req.user.userId;
    return this.ticketService.createWithMultipleSeatsAndFoodDrinks(
      userId,
      data.screening_id,
      data.seat_ids,
      data.prices,
      data.food_drinks,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả vé' })
  findAll() {
    return this.ticketService.findAll();
  }

  @Get('my-tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy các vé của người dùng hiện tại' })
  async getMyTickets(@Req() req) {
    const userId = req.user.userId;
    return this.ticketService.findByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin một vé' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ticketService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật một vé' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTicketDto: UpdateTicketDto,
  ) {
    return this.ticketService.update(id, updateTicketDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa một vé' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ticketService.remove(id);
  }

  @Get('history/with-food-drinks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy lịch sử đặt vé cùng với thông tin đồ ăn/đồ uống',
  })
  async getTicketsWithFoodDrinks(@Req() req) {
    const userId = req.user.userId;
    return this.ticketService.getTicketsWithFoodDrinks(userId);
  }

  @Post('cleanup-pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Xóa vé chưa thanh toán và SeatReservation của user cho screeningId',
  })
  async cleanupPending(@Req() req, @Body() body: { screeningId: number }) {
    const userId = req.user.userId;
    const { screeningId } = body;
    await this.ticketService.cleanupUserPendingTickets(userId, screeningId);
    return { success: true };
  }

  @Post('verify-qr')
  @ApiOperation({ summary: 'Xác nhận vé bằng mã QR' })
  async verifyTicketByQRCode(@Body() verifyQRDto: VerifyQRDto) {
    return this.ticketService.verifyTicketByQRCode(verifyQRDto.qr_code);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TicketSeatService } from './ticket-seats.service';
import { JwtAuthGuard } from '../auth/passport/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('ticket-seats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ticket-seats')
export class TicketSeatsController {
  constructor(private readonly ticketSeatService: TicketSeatService) {}

  @Post(':ticketId/seats/:seatId')
  @ApiOperation({ summary: 'Thêm một ghế vào vé' })
  @ApiResponse({ status: 201, description: 'Thêm ghế thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async addSeatToTicket(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('seatId', ParseIntPipe) seatId: number,
    @Body('price') price?: number,
  ) {
    return this.ticketSeatService.create(ticketId, seatId, price);
  }

  @Post(':ticketId/seats')
  @ApiOperation({ summary: 'Thêm nhiều ghế vào vé' })
  @ApiResponse({ status: 201, description: 'Thêm các ghế thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async addMultipleSeatsToTicket(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() data: { seatIds: number[]; prices?: number[] },
  ) {
    return this.ticketSeatService.addMultipleSeatsToTicket(
      ticketId,
      data.seatIds,
      data.prices,
    );
  }

  @Get(':ticketId/seats')
  @ApiOperation({ summary: 'Lấy tất cả ghế của một vé' })
  @ApiResponse({ status: 200, description: 'Danh sách ghế của vé' })
  async findAllByTicketId(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.ticketSeatService.findAllByTicketId(ticketId);
  }

  @Delete(':ticketId/seats/:seatId')
  @ApiOperation({ summary: 'Xóa ghế khỏi vé' })
  @ApiResponse({ status: 200, description: 'Xóa ghế thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy ghế trong vé' })
  async remove(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('seatId', ParseIntPipe) seatId: number,
  ) {
    await this.ticketSeatService.remove(ticketId, seatId);
    return { message: 'Xóa ghế khỏi vé thành công' };
  }
}

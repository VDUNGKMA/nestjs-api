// src/seats/seat.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { SeatService } from './seats.service';
import { CreateSeatDto } from './dto/create-seat.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';

@Controller('seats')
export class SeatController {
  constructor(private seatService: SeatService) {}
 
  @Post()
  create(@Body() createSeatDto: CreateSeatDto) {
    return this.seatService.createSeat(createSeatDto);
  }
  
  @Get()
  findAll(
    @Query('theaterRoomId', new ParseIntPipe({ optional: true }))
    theaterRoomId?: number,
  ) {
    return this.seatService.findAll(theaterRoomId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.seatService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSeatDto: UpdateSeatDto,
  ) {
    return this.seatService.update(id, updateSeatDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.seatService.remove(id);
  }
}

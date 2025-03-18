import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { TheaterRoomService } from './theater_room.service';
import { CreateTheaterRoomDto } from './dto/theater-room.dto';

@Controller('theater-rooms')
export class TheaterRoomController {
  constructor(private readonly theaterRoomService: TheaterRoomService) {}

  @Post()
  create(@Body() createTheaterRoomDto: CreateTheaterRoomDto) {
    return this.theaterRoomService.create(createTheaterRoomDto);
  }

  @Get()
  findAll() {
    return this.theaterRoomService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.theaterRoomService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: number,
    @Body() updateData: Partial<CreateTheaterRoomDto>,
  ) {
    return this.theaterRoomService.update(id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.theaterRoomService.remove(id);
  }
}

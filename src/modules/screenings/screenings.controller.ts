// src/screenings/screening.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ScreeningService } from './screenings.service';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { UpdateScreeningDto } from './dto/update-screening.dto';
import { Public } from 'src/decorators/public-route.decorator';

@Controller('screenings')
export class ScreeningController {
  constructor(private readonly screeningService: ScreeningService) {}

  @Post()
  create(@Body() createScreeningDto: CreateScreeningDto) {
    return this.screeningService.create(createScreeningDto);
  }

  @Get('admin')
  findAllForAdmin(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? Number(page) : 1;
    const pageSizeNum = pageSize ? Number(pageSize) : 10;
    return this.screeningService.findAllForAdmin(pageNum, pageSizeNum);
  }
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.screeningService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateScreeningDto: UpdateScreeningDto,
  ) {
    return this.screeningService.update(id, updateScreeningDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.screeningService.remove(id);
  }

  @Public()
  @Get()
  findAll(
    @Query('date') date?: string,
    @Query('theaterId') theaterId?: number,
    @Query('theaterRoomId') theaterRoomId?: number,
    @Query('movieId') movieId?: number,
  ) {
    return this.screeningService.findAll({
      date,
      theaterId,
      theaterRoomId,
      movieId,
    });
  }
}

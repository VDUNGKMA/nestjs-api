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
} from '@nestjs/common';
import { ScreeningService } from './screenings.service';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { UpdateScreeningDto } from './dto/update-screening.dto';

@Controller('screenings')
export class ScreeningController {
  constructor(private readonly screeningService: ScreeningService) {}

  @Post()
  create(@Body() createScreeningDto: CreateScreeningDto) {
    return this.screeningService.create(createScreeningDto);
  }

  @Get()
  findAll() {
    return this.screeningService.findAll();
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
}

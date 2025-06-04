import { IsNumber, IsArray, IsBoolean, IsOptional } from 'class-validator';

export class SuggestAlternativeSeatsDto {
  @IsNumber()
  screeningId: number;

  @IsArray()
  @IsNumber({}, { each: true })
  seatIds: number[];

  @IsNumber()
  count: number;

  @IsOptional()
  @IsBoolean()
  preferPairs?: boolean;
}

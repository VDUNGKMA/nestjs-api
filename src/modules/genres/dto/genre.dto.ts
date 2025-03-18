import { IsNotEmpty, IsString } from 'class-validator';

export class CreateGenreDto {
  @IsNotEmpty()
  @IsString()
  name: string;
}

export class UpdateGenreDto {
  @IsString()
  name?: string;
}

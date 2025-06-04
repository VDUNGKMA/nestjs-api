import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyQRDto {
  @IsString()
  @IsNotEmpty()
  qr_code: string;
}

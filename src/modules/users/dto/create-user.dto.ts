import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

  @IsOptional()
  @IsString()
  readonly password?: string;

  @IsOptional() // Trường này là tùy chọn
  @IsEnum(['admin', 'staff', 'customer']) // Giới hạn giá trị
  readonly role?: 'admin' | 'staff' | 'customer';

  @IsOptional() // Trường này là tùy chọn và có thể null
  @IsString()
  @IsUrl()
  readonly image?: string | null; // URL ảnh đại diện có thể null
}

import { IsEmail, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address of the user',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'The user password',
    minLength: 8,
  })
  @IsString()
  password: string;

  @ApiProperty({
    example: '123456',
    description: 'Two-factor authentication code (required if 2FA is enabled)',
    required: false,
  })
  @IsString()
  @IsOptional()
  twoFactorCode?: string;
}
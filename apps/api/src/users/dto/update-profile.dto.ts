import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'The full name of the user',
    required: false,
  })
  @IsString()
  @MinLength(1, { message: 'Name cannot be empty' })
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'The phone number of the user',
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string | null;
}
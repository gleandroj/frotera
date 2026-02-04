import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLanguageDto {
  @ApiProperty({
    example: 'en',
    description: 'Language code (en, pt, etc.)',
  })
  @IsString()
  language: string;
}


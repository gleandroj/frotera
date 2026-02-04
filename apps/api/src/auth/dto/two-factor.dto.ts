import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyTwoFactorDto {
  @ApiProperty({
    example: '123456',
    description: 'The two-factor authentication code',
  })
  @IsString()
  token: string;

  @ApiProperty({
    example: true,
    description: 'Whether to enable 2FA after verification',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  enable?: boolean;

  @ApiProperty({
    example: 'https://example.com/qr-code',
    description: 'The QR code URL',
    required: false,
  })
  @IsString()
  @IsOptional()
  qrCode?: string;
}

export class DisableTwoFactorDto {
  @ApiProperty({
    example: '123456',
    description: 'The two-factor authentication code required to disable 2FA',
  })
  @IsString()
  token: string;
}
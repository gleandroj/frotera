import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export enum ReferencePointTypeEnum {
  DEPOT = 'DEPOT',
  CUSTOMER_SITE = 'CUSTOMER_SITE',
  FUEL_STATION = 'FUEL_STATION',
  WORKSHOP = 'WORKSHOP',
  OTHER = 'OTHER',
}

export class CreateReferencePointDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(50000)
  radiusMeters?: number;

  @ApiPropertyOptional({ enum: ReferencePointTypeEnum })
  @IsOptional()
  @IsEnum(ReferencePointTypeEnum)
  type?: ReferencePointTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateReferencePointDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(50000)
  radiusMeters?: number;

  @ApiPropertyOptional({ enum: ReferencePointTypeEnum })
  @IsOptional()
  @IsEnum(ReferencePointTypeEnum)
  type?: ReferencePointTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReferencePointResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiPropertyOptional()
  customerId?: string | null;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  latitude: number;

  @ApiProperty()
  longitude: number;

  @ApiProperty()
  radiusMeters: number;

  @ApiProperty({ enum: ReferencePointTypeEnum })
  type: ReferencePointTypeEnum;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BRAZIL_UF_SIGLAS } from '@gleandroj/shared';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const BRAZIL_UF_LIST = [...BRAZIL_UF_SIGLAS] as [string, ...string[]];

export enum FuelTypeEnum {
  GASOLINE = 'GASOLINE',
  ETHANOL = 'ETHANOL',
  DIESEL = 'DIESEL',
  ELECTRIC = 'ELECTRIC',
  GNV = 'GNV',
}

// ── Create ────────────────────────────────────────────────────────────────────
export class CreateFuelLogDto {
  @ApiProperty({ description: 'Vehicle ID' })
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @ApiPropertyOptional({ description: 'Driver ID (optional)' })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiProperty({ description: 'Date/time of fueling (ISO 8601)' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Odometer reading in km at time of fueling (0 or positive, max 10 digits)' })
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  odometer: number;

  @ApiProperty({ description: 'Liters fueled' })
  @IsNumber()
  @IsPositive()
  liters: number;

  @ApiProperty({ description: 'Price per liter' })
  @IsNumber()
  @IsPositive()
  pricePerLiter: number;

  @ApiProperty({ enum: FuelTypeEnum })
  @IsEnum(FuelTypeEnum)
  fuelType: FuelTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  station?: string;

  @ApiPropertyOptional({ description: 'Brazilian state (UF), e.g. RS' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const s = value.trim().toUpperCase();
    return s === '' ? undefined : s;
  })
  @IsString()
  @IsIn(BRAZIL_UF_LIST)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Receipt file URL (S3)' })
  @IsOptional()
  @IsString()
  receipt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Update ────────────────────────────────────────────────────────────────────
export class UpdateFuelLogDto {
  @ApiPropertyOptional({ nullable: true, description: 'Motorista; null remove o vínculo' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  driverId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  odometer?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  liters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  pricePerLiter?: number;

  @ApiPropertyOptional({ enum: FuelTypeEnum })
  @IsOptional()
  @IsEnum(FuelTypeEnum)
  fuelType?: FuelTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  station?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const s = value.trim().toUpperCase();
    return s === '' ? undefined : s;
  })
  @IsString()
  @IsIn(BRAZIL_UF_LIST)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receipt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── List query params ─────────────────────────────────────────────────────────
export class ListFuelLogsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Start date ISO 8601' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date ISO 8601' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: FuelTypeEnum })
  @IsOptional()
  @IsEnum(FuelTypeEnum)
  fuelType?: FuelTypeEnum;
}

// ── Stats query params ────────────────────────────────────────────────────────
export class FuelStatsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Start date ISO 8601' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date ISO 8601' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

// ── Response ──────────────────────────────────────────────────────────────────
export class FuelLogResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() vehicleId: string;
  @ApiPropertyOptional() driverId?: string | null;
  @ApiProperty() createdById: string;
  @ApiProperty() date: string;
  @ApiProperty() odometer: number;
  @ApiProperty() liters: number;
  @ApiProperty() pricePerLiter: number;
  @ApiProperty() totalCost: number;
  @ApiProperty({ enum: FuelTypeEnum }) fuelType: FuelTypeEnum;
  @ApiPropertyOptional() station?: string | null;
  @ApiPropertyOptional() state?: string | null;
  @ApiPropertyOptional() city?: string | null;
  @ApiPropertyOptional() receipt?: string | null;
  @ApiPropertyOptional() notes?: string | null;
  @ApiPropertyOptional() consumption?: number | null; // km/l
  @ApiPropertyOptional() marketPriceRef?: number | null; // market price reference at time of fueling
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;

  // Joined fields
  @ApiPropertyOptional() vehicle?: { id: string; name: string | null; plate: string | null };
  @ApiPropertyOptional() driver?: { id: string; name: string } | null;
}

// ── Stats response ────────────────────────────────────────────────────────────
export class FuelStatsResponseDto {
  @ApiProperty({ description: 'Total cost in the period' })
  totalCost: number;

  @ApiProperty({ description: 'Total liters in the period' })
  totalLiters: number;

  @ApiProperty({ description: 'Number of fuel logs in the period' })
  count: number;

  @ApiPropertyOptional({ description: 'Average consumption (km/l) weighted by distance — null when insufficient data' })
  avgConsumption: number | null;

  @ApiPropertyOptional({ description: 'Average cost per km — null when insufficient data' })
  avgCostPerKm: number | null;

  @ApiProperty({ description: 'Total cost of fuel logs in the current calendar month' })
  currentMonthCost: number;

  @ApiProperty({ description: 'Number of fuel logs in the current calendar month' })
  currentMonthCount: number;
}

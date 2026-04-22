import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';

// ────────────────────────────────────────────────────────────────────────────
// Query DTOs
// ────────────────────────────────────────────────────────────────────────────

export class FuelReportBaseQueryDto {
  @ApiPropertyOptional({ description: 'Filter by vehicle IDs', type: [String] })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  @IsArray()
  @IsString({ each: true })
  vehicleIds?: string[];

  @ApiPropertyOptional({ description: 'Restrict to vehicles under these customers (subtrees)', type: [String] })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  @IsArray()
  @IsString({ each: true })
  customerIds?: string[];

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class ConsumptionReportQueryDto extends FuelReportBaseQueryDto {
  @ApiPropertyOptional({
    enum: ['day', 'month', 'year'],
    description: 'Group time series by period',
  })
  @IsOptional()
  @IsEnum(['day', 'month', 'year'])
  groupBy?: 'day' | 'month' | 'year';
}

export class CostsReportQueryDto extends FuelReportBaseQueryDto {
  @ApiPropertyOptional({
    enum: ['day', 'month', 'year'],
    description: 'Group results by period',
  })
  @IsOptional()
  @IsEnum(['day', 'month', 'year'])
  groupBy?: 'day' | 'month' | 'year';
}

export class BenchmarkReportQueryDto extends FuelReportBaseQueryDto {
  @ApiPropertyOptional({ description: 'State code (default: organization state)' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    enum: ['day', 'month', 'year'],
    description: 'Group time series by period',
  })
  @IsOptional()
  @IsEnum(['day', 'month', 'year'])
  groupBy?: 'day' | 'month' | 'year';
}

export class EfficiencyReportQueryDto extends FuelReportBaseQueryDto {
  @ApiPropertyOptional({
    description: 'Consumption drop threshold percentage (default: 15)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  thresholdPct?: number;
}

export class SummaryReportQueryDto {
  @ApiPropertyOptional({ description: 'Filter by vehicle IDs', type: [String] })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  @IsArray()
  @IsString({ each: true })
  vehicleIds?: string[];

  @ApiPropertyOptional({ description: 'Restrict to vehicles under these customers (subtrees)', type: [String] })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  @IsArray()
  @IsString({ each: true })
  customerIds?: string[];

  @ApiProperty({
    enum: ['day', 'month', 'year'],
    description: 'Period type',
  })
  @IsEnum(['day', 'month', 'year'])
  period: 'day' | 'month' | 'year';

  @ApiProperty({ description: 'Reference date (ISO 8601)' })
  @IsDateString()
  date: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Response DTOs
// ────────────────────────────────────────────────────────────────────────────

export class VehicleConsumptionDto {
  @ApiProperty() vehicleId: string;
  @ApiPropertyOptional() vehicleName: string | null;
  @ApiPropertyOptional() vehiclePlate: string | null;
  @ApiPropertyOptional({ description: 'Average consumption (km/l)' })
  avgConsumption: number | null;
  @ApiPropertyOptional() bestConsumption: number | null;
  @ApiPropertyOptional() worstConsumption: number | null;
  @ApiPropertyOptional({ description: 'Total kilometers in period' })
  totalKm: number | null;
  @ApiProperty() totalLiters: number;
  @ApiProperty() logsCount: number;
  @ApiProperty({
    enum: ['improving', 'worsening', 'stable', 'insufficient_data'],
  })
  trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data';
  @ApiProperty({
    description: 'Time series of consumption over time',
    type: [Object],
  })
  timeSeries: Array<{ date: string; consumption: number | null }>;
}

export class CostsPeriodDto {
  @ApiProperty({ description: 'Period identifier (YYYY-MM-DD | YYYY-MM | YYYY)' })
  period: string;
  @ApiProperty() totalCost: number;
  @ApiProperty() totalLiters: number;
  @ApiProperty() logsCount: number;
  @ApiPropertyOptional() avgPricePerLiter: number | null;
  @ApiPropertyOptional({ description: 'Cost per kilometer' })
  costPerKm: number | null;
  @ApiProperty({
    description: 'Cost breakdown by fuel type',
    type: Object,
  })
  byFuelType: Record<string, { cost: number; liters: number }>;
}

export class BenchmarkPointDto {
  @ApiProperty() date: string;
  @ApiProperty() avgPricePaid: number;
  @ApiPropertyOptional() marketAvgPrice: number | null;
  @ApiPropertyOptional({
    description: 'Positive = paid more than market',
  })
  difference: number | null;
}

export class BenchmarkSummaryDto {
  @ApiProperty() totalPaid: number;
  @ApiPropertyOptional() totalAtMarketPrice: number | null;
  @ApiPropertyOptional({
    description: 'Positive = overpaid vs market',
  })
  totalOverpaid: number | null;
  @ApiPropertyOptional({
    description: 'Percentage above market price',
  })
  overpaidPct: number | null;
  @ApiProperty({
    description: 'Time series of price comparison',
    type: [BenchmarkPointDto],
  })
  timeSeries: BenchmarkPointDto[];
}

export class VehicleEfficiencyDto {
  @ApiProperty() vehicleId: string;
  @ApiPropertyOptional() vehicleName: string | null;
  @ApiPropertyOptional() vehiclePlate: string | null;
  @ApiPropertyOptional({
    description: 'Average consumption of last 3 fuel logs (km/l)',
  })
  currentAvgConsumption: number | null;
  @ApiPropertyOptional({
    description: 'Average consumption of all fuel logs (km/l)',
  })
  historicalAvgConsumption: number | null;
  @ApiPropertyOptional({
    description: 'Consumption drop percentage',
  })
  consumptionDropPct: number | null;
  @ApiProperty({
    description: 'Alert triggered if drop exceeds threshold',
  })
  isAlert: boolean;
  @ApiPropertyOptional({
    description: 'Estimated extra cost due to inefficiency',
  })
  estimatedExtraCost: number | null;
  @ApiPropertyOptional({ description: 'Date of last fuel log' })
  lastFuelDate: string | null;
}

export class PeriodSummaryDto {
  @ApiProperty({ description: 'Period identifier' })
  period: string;
  @ApiProperty() totalCost: number;
  @ApiProperty() totalLiters: number;
  @ApiProperty() logsCount: number;
  @ApiPropertyOptional() avgConsumption: number | null;
  @ApiPropertyOptional({ description: 'Average price paid per liter' })
  avgPricePaid: number | null;
  @ApiPropertyOptional({ description: 'Average market price per liter' })
  avgMarketPrice: number | null;
  @ApiPropertyOptional({ description: 'Average cost per kilometer' })
  costPerKm: number | null;
  @ApiProperty({
    description: 'Comparison with previous equivalent period',
  })
  vsLastPeriod: {
    costChangePct: number | null;
    consumptionChangePct: number | null;
    litersChangePct: number | null;
  };
}

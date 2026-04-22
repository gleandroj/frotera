import { IsDateString, IsOptional, IsString, IsInt, IsNumber, IsArray, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TripsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() driverId?: string;
  @ApiPropertyOptional({ default: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number = 50;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number = 0;
}

export class StopsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional({ default: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number = 50;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number = 0;
}

export class PositionsReportQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional({ default: 500 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) limit?: number = 500;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number = 0;
  /** Which timestamp to filter and sort by: 'recordedAt' (device clock) or 'receivedAt' (server clock). Default: receivedAt */
  @ApiPropertyOptional({ enum: ['recordedAt', 'receivedAt'], default: 'receivedAt' })
  @IsOptional() @IsString() dateField?: 'recordedAt' | 'receivedAt' = 'receivedAt';
}

export class DetectTripsDto {
  @IsString() vehicleId: string;
  @IsDateString() from: string;
  @IsDateString() to: string;
}

export class ReferencePointsProximityQueryDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  @IsArray()
  @IsString({ each: true })
  vehicleIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  @IsArray()
  @IsString({ each: true })
  customerIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Reference point IDs to include (empty = all active)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  @IsArray()
  @IsString({ each: true })
  referencePointIds?: string[];

  @ApiProperty({ description: 'Start date (ISO 8601)' })
  @IsDateString()
  dateFrom: string;

  @ApiProperty({ description: 'End date (ISO 8601)' })
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional({ description: 'Only include positions within this distance (meters)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDistanceMeters?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number = 100;
}

export class ReferencePointProximityRowDto {
  positionId: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  ignitionOn: boolean | null;
  vehicleId: string;
  vehicleName: string | null;
  vehiclePlate: string | null;
  closestReferencePointId: string;
  closestReferencePointName: string;
  closestDistanceMeters: number;
}

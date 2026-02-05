import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TrackerModel } from "@prisma/client";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

// ─── Internal types ──────────────────────────────────────────────────────────

/** Normalized position payload (internal + Redis stream) */
export interface NormalizedPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  recordedAt: string; // ISO string
  alarmFlags?: number;
}

// ─── Devices ─────────────────────────────────────────────────────────────────

export class TrackerDeviceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  imei: string;

  @ApiProperty({ enum: TrackerModel })
  model: TrackerModel;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  vehicleId?: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class CreateTrackerDeviceDto {
  @ApiProperty({ example: "123456789012345" })
  @IsString()
  imei: string;

  @ApiProperty({ enum: TrackerModel })
  @IsEnum(TrackerModel)
  model: TrackerModel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

export class UpdateTrackerDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

// ─── Positions ───────────────────────────────────────────────────────────────

export class PositionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  deviceId: string;

  @ApiProperty()
  latitude: number;

  @ApiProperty()
  longitude: number;

  @ApiPropertyOptional()
  altitude?: number | null;

  @ApiPropertyOptional()
  speed?: number | null;

  @ApiPropertyOptional()
  heading?: number | null;

  @ApiProperty()
  recordedAt: string;

  @ApiProperty()
  createdAt: string;
}

export class PositionHistoryQueryDto {
  @ApiPropertyOptional({ description: "Start date (ISO)" })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: "End date (ISO)" })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: "Max number of positions", default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 100;
}

// ─── Vehicles ────────────────────────────────────────────────────────────────

export class VehicleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  plate?: string | null;

  @ApiPropertyOptional()
  trackerDeviceId?: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class CreateVehicleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plate?: string;

  @ApiPropertyOptional({ description: "Link to existing tracker device" })
  @IsOptional()
  @IsString()
  trackerDeviceId?: string;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackerDeviceId?: string;
}

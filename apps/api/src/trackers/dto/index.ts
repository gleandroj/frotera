import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TrackerModel } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateIf,
  ValidateNested,
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
  // GT06 status fields
  ignitionOn?: boolean;
  voltageLevel?: number;
  gsmSignal?: number;
  alarmCode?: number;
  chargeOn?: boolean;
  powerCut?: boolean;
  lbsMcc?: number;
  lbsMnc?: number;
  lbsLac?: number;
  lbsCellId?: number;
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
  serialSat?: string | null;

  @ApiPropertyOptional()
  equipmentModel?: string | null;

  @ApiPropertyOptional()
  individualPassword?: string | null;

  @ApiPropertyOptional()
  carrier?: string | null;

  @ApiPropertyOptional()
  simCardNumber?: string | null;

  @ApiPropertyOptional()
  cellNumber?: string | null;

  /** Set when device is connected to the tracker TCP server; null when disconnected. */
  @ApiPropertyOptional({ type: String, nullable: true })
  connectedAt?: string | null;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialSat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  equipmentModel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  individualPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  simCardNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cellNumber?: string;
}

export class UpdateTrackerDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialSat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  equipmentModel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  individualPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  simCardNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cellNumber?: string;
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

/** Minimal customer info when returned nested in vehicle (avoids Swagger circular ref) */
export class VehicleCustomerSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

/** Minimal device info when returned nested in vehicle */
export class VehicleTrackerDeviceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  imei: string;

  @ApiProperty({ enum: TrackerModel })
  model: TrackerModel;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  serialSat?: string | null;

  @ApiPropertyOptional()
  equipmentModel?: string | null;

  @ApiPropertyOptional()
  carrier?: string | null;

  @ApiPropertyOptional()
  simCardNumber?: string | null;

  @ApiPropertyOptional()
  cellNumber?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  connectedAt?: string | null;
}

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
  serial?: string | null;

  @ApiPropertyOptional()
  color?: string | null;

  @ApiPropertyOptional()
  year?: string | null;

  @ApiPropertyOptional()
  renavam?: string | null;

  @ApiPropertyOptional()
  chassis?: string | null;

  @ApiPropertyOptional()
  vehicleType?: string | null;

  @ApiPropertyOptional()
  inactive?: boolean;

  @ApiPropertyOptional({ nullable: true, description: "Limite km/h para alertas de excesso de velocidade" })
  speedLimit?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Hodômetro inicial (km) ao cadastrar o veículo na frota",
  })
  initialOdometerKm?: number | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiPropertyOptional()
  trackerDeviceId?: string | null;

  @ApiPropertyOptional()
  customerId?: string | null;

  /** Minimal customer info when included (list/get) */
  @ApiPropertyOptional({ type: () => VehicleCustomerSummaryDto, nullable: true })
  customer?: VehicleCustomerSummaryDto | null;

  /** Associated tracker device when included (list/get) */
  @ApiPropertyOptional({ type: () => VehicleTrackerDeviceDto, nullable: true })
  trackerDevice?: VehicleTrackerDeviceDto | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

/** Device info when creating a new tracker device with the vehicle */
export class CreateVehicleNewDeviceDto {
  @ApiProperty({ example: "123456789012345", description: "Device IMEI" })
  @IsString()
  imei: string;

  @ApiProperty({ enum: TrackerModel, description: "Tracker model" })
  @IsEnum(TrackerModel)
  model: TrackerModel;

  @ApiPropertyOptional({ description: "Optional device display name" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialSat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  equipmentModel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  individualPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  simCardNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cellNumber?: string;
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  year?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  renavam?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chassis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inactive?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: "Limite de velocidade em km/h (null = sem monitoramento)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  speedLimit?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Hodômetro inicial (km) ao cadastrar o veículo na frota",
  })
  @IsOptional()
  @Type(() => Number)
  @ValidateIf((_, v) => v != null)
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  initialOdometerKm?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: "Link to existing tracker device (ignored if newDevice is set)" })
  @IsOptional()
  @IsString()
  trackerDeviceId?: string;

  @ApiPropertyOptional({ description: "Customer ID to associate" })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: "Create and link a new tracker device (IMEI + model). Takes precedence over trackerDeviceId.",
    type: () => CreateVehicleNewDeviceDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateVehicleNewDeviceDto)
  newDevice?: CreateVehicleNewDeviceDto;
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
  serial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  year?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  renavam?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chassis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inactive?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: "Limite de velocidade em km/h (null = sem monitoramento)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  speedLimit?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Hodômetro inicial (km); null remove o valor",
  })
  @IsOptional()
  @Type(() => Number)
  @ValidateIf((_, v) => v != null)
  @IsNumber()
  @Min(0)
  @Max(9_999_999_999)
  initialOdometerKm?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackerDeviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;
}

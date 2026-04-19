import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  AlertSeverity,
  AlertType,
  GeofenceType,
} from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  Max,
  MinLength,
} from "class-validator";

export class ListAlertsQueryDto {
  @ApiPropertyOptional({ enum: AlertType })
  @IsOptional()
  @IsEnum(AlertType)
  type?: AlertType;

  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({
    description: "Filtra alertas por veículos desta empresa (e filiais)",
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: "true = só reconhecidos, false = só não reconhecidos",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (value === true || value === "true" || value === 1 || value === "1")
      return true;
    if (value === false || value === "false" || value === 0 || value === "0")
      return false;
    return undefined;
  })
  @IsBoolean()
  acknowledged?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit = 50;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset = 0;
}

export class TelemetryAlertResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiPropertyOptional({ nullable: true })
  vehicleId!: string | null;

  @ApiProperty()
  deviceId!: string;

  @ApiProperty({ enum: AlertType })
  type!: AlertType;

  @ApiProperty({ enum: AlertSeverity })
  severity!: AlertSeverity;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  acknowledgedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  acknowledgedBy!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional()
  vehicle?: { id: string; name: string | null; plate: string | null } | null;

  @ApiPropertyOptional()
  device?: { id: string; imei: string; name: string | null } | null;
}

export class AlertStatsResponseDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  unacknowledged!: number;

  @ApiProperty()
  byType!: Record<string, number>;

  @ApiProperty()
  bySeverity!: Record<string, number>;
}

export class CreateGeofenceDto {
  @ApiProperty({ description: "Customer (empresa) that owns this zone; filiais see ancestor zones." })
  @IsString()
  @MinLength(1)
  customerId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: GeofenceType })
  @IsEnum(GeofenceType)
  type!: GeofenceType;

  @ApiProperty({
    description: "CIRCLE: { center, radius } | POLYGON: { points }",
  })
  @IsObject()
  coordinates!: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vehicleIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertOnEnter?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertOnExit?: boolean;
}

export class UpdateGeofenceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: GeofenceType })
  @IsOptional()
  @IsEnum(GeofenceType)
  type?: GeofenceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  coordinates?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vehicleIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertOnEnter?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertOnExit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class GeofenceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiPropertyOptional({ nullable: true })
  customerName?: string | null;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: GeofenceType })
  type!: GeofenceType;

  @ApiProperty()
  coordinates!: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  vehicleIds!: string[];

  @ApiProperty()
  alertOnEnter!: boolean;

  @ApiProperty()
  alertOnExit!: boolean;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

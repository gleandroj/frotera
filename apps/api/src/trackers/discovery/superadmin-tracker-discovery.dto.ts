import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TrackerModel } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class TrackerDiscoveryLoginResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  imei: string;

  @ApiPropertyOptional({ nullable: true })
  protocol: string | null;

  @ApiProperty()
  firstSeenAt: string;

  @ApiProperty()
  lastSeenAt: string;

  @ApiProperty()
  loginCount: number;

  @ApiPropertyOptional({ nullable: true })
  lastRemoteAddress: string | null;
}

export class SuperadminOrganizationSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class SuperadminVehicleWithoutTrackerDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  plate: string | null;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;

  @ApiProperty()
  customer: { id: string; name: string };
}

export class RegisterDiscoveryToVehicleDto {
  @ApiProperty({ description: "Vehicle id (must have no tracker yet)" })
  @IsString()
  vehicleId: string;

  @ApiPropertyOptional({ enum: TrackerModel, default: TrackerModel.X12_GT06 })
  @IsOptional()
  @IsEnum(TrackerModel)
  model?: TrackerModel;
}

export class RegisterDiscoveryToVehicleResponseDto {
  @ApiProperty()
  deviceId: string;

  @ApiProperty()
  vehicleId: string;

  @ApiProperty()
  organizationId: string;
}

/** Path param: 15-digit IMEI */
export const IMEI_PARAM_REGEX = /^\d{15}$/;

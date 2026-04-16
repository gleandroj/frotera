import {
  IsString, IsOptional, IsBoolean, IsEmail,
  IsDateString, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDriverDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'CPF do motorista (único por organização)' })
  @IsOptional()
  @IsString()
  @MaxLength(14) // "000.000.000-00"
  cpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnh?: string;

  @ApiPropertyOptional({ enum: ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'] })
  @IsOptional()
  @IsString()
  cnhCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  cnhExpiry?: string; // ISO 8601 date string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'URL da foto do motorista' })
  @IsOptional()
  @IsString()
  photo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string | null; // null = desvincula da empresa

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnh?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnhCategory?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  cnhExpiry?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class AssignVehicleDto {
  @ApiProperty()
  @IsString()
  vehicleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class DriverVehicleAssignmentResponseDto {
  id: string;
  driverId: string;
  vehicleId: string;
  startDate: string;
  endDate?: string | null;
  isPrimary: boolean;
  vehicle?: {
    id: string;
    name?: string | null;
    plate?: string | null;
  };
}

export class DriverResponseDto {
  id: string;
  organizationId: string;
  customerId?: string | null;
  name: string;
  cpf?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  cnhExpiry?: string | null;
  phone?: string | null;
  email?: string | null;
  photo?: string | null;
  active: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string } | null;
  vehicleAssignments?: DriverVehicleAssignmentResponseDto[];
}

export class DriversListResponseDto {
  drivers: DriverResponseDto[];
}

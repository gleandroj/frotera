import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum RoleModuleEnum {
  VEHICLES  = 'VEHICLES',
  TRACKING  = 'TRACKING',
  TRACKER_DISCOVERIES = 'TRACKER_DISCOVERIES',
  COMPANIES = 'COMPANIES',
  USERS     = 'USERS',
  REPORTS   = 'REPORTS',
  DRIVERS   = 'DRIVERS',
  DOCUMENTS = 'DOCUMENTS',
  FUEL      = 'FUEL',
  CHECKLIST = 'CHECKLIST',
  INCIDENTS = 'INCIDENTS',
  TELEMETRY = 'TELEMETRY',
  FINANCIAL = 'FINANCIAL',
}

export enum RoleActionEnum {
  VIEW   = 'VIEW',
  CREATE = 'CREATE',
  EDIT   = 'EDIT',
  DELETE = 'DELETE',
}

export enum RoleScopeEnum {
  ALL      = 'ALL',
  ASSIGNED = 'ASSIGNED',
}

export enum SystemRoleKey {
  ORGANIZATION_OWNER = 'ORGANIZATION_OWNER',
  COMPANY_OWNER      = 'COMPANY_OWNER',
  COMPANY_ADMIN      = 'COMPANY_ADMIN',
  OPERATOR           = 'OPERATOR',
  VIEWER             = 'VIEWER',
  DRIVER             = 'DRIVER',
}

export class PermissionDto {
  @ApiProperty({ enum: RoleModuleEnum })
  @IsEnum(RoleModuleEnum)
  module: RoleModuleEnum;

  @ApiProperty({ enum: RoleActionEnum, isArray: true })
  @IsArray()
  @IsEnum(RoleActionEnum, { each: true })
  actions: RoleActionEnum[];

  @ApiProperty({ enum: RoleScopeEnum })
  @IsEnum(RoleScopeEnum)
  scope: RoleScopeEnum;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Financeiro' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Acesso ao módulo financeiro' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#EF4444' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color e.g. #FF0000' })
  color?: string;

  @ApiProperty({ type: () => [PermissionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions: PermissionDto[];
}

export class UpdateRoleDto {
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
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color e.g. #FF0000' })
  color?: string;

  @ApiPropertyOptional({ type: () => [PermissionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];
}

export class RolePermissionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: RoleModuleEnum })
  module: RoleModuleEnum;

  @ApiProperty({ enum: RoleActionEnum, isArray: true })
  actions: RoleActionEnum[];

  @ApiProperty({ enum: RoleScopeEnum })
  scope: RoleScopeEnum;
}

export class RoleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  isSystem: boolean;

  @ApiPropertyOptional()
  color?: string | null;

  @ApiPropertyOptional()
  organizationId?: string | null;

  @ApiProperty({ type: () => [RolePermissionResponseDto] })
  permissions: RolePermissionResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class RolesListResponseDto {
  @ApiProperty({ type: () => [RoleResponseDto] })
  roles: RoleResponseDto[];
}

export class RoleCreatedResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => RoleResponseDto })
  role: RoleResponseDto;
}

export class RoleUpdatedResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => RoleResponseDto })
  role: RoleResponseDto;
}

export class RoleDeletedResponseDto {
  @ApiProperty()
  message: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { RoleResponseDto } from '../roles/roles.dto';

export class CreateMemberDto {
  @ApiProperty({ description: 'Email address for the new user', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password for the new user', example: 'securepassword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Grants global super admin privileges (super admin actor only)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isSuperAdmin?: boolean;

  @ApiPropertyOptional({
    description: 'Marks account as system/internal user (super admin actor only)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isSystemUser?: boolean;

  @ApiProperty({ description: 'Role ID to assign to the new member' })
  @IsString()
  roleId: string;

  @ApiPropertyOptional({ description: 'Whether the member is restricted to specific customers' })
  @IsOptional()
  @IsBoolean()
  customerRestricted?: boolean;

  @ApiPropertyOptional({
    description: 'Customer IDs the member can access (when customerRestricted is true)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customerIds?: string[];

  @ApiPropertyOptional({
    description: 'Send login credentials (email + temporary password) to the new user via email',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  sendCredentials?: boolean;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ description: 'Role ID to assign' })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional({ description: 'Whether member is restricted to specific customers' })
  @IsOptional()
  @IsBoolean()
  customerRestricted?: boolean;

  @ApiPropertyOptional({
    description: 'Customer IDs the member can access (when customerRestricted is true)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customerIds?: string[];

  @ApiPropertyOptional({ description: 'Display name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'New password (min 8 characters)', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;

  @ApiPropertyOptional({
    description: 'Grants global super admin privileges (super admin actor only)',
  })
  @IsOptional()
  @IsBoolean()
  isSuperAdmin?: boolean;

  @ApiPropertyOptional({
    description: 'Marks account as system/internal user (super admin actor only)',
  })
  @IsOptional()
  @IsBoolean()
  isSystemUser?: boolean;
}

export class MemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: () => RoleResponseDto })
  role: RoleResponseDto;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty({ description: "Whether the member account is active in this organization" })
  isActive: boolean;

  @ApiProperty({ description: 'Whether member is restricted to specific customers' })
  customerRestricted: boolean;

  @ApiProperty({
    description: 'Customers the member has access to (when customerRestricted)',
    type: 'array',
    items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
  })
  customers: { id: string; name: string }[];

  @ApiProperty()
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    isSuperAdmin?: boolean;
    isSystemUser?: boolean;
  };
}

export class MembersListResponseDto {
  @ApiProperty({ type: () => [MemberResponseDto] })
  memberships: MemberResponseDto[];
}

export class UpdateMemberResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => MemberResponseDto })
  member: MemberResponseDto;
}

export class CreateMemberResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => MemberResponseDto })
  member: MemberResponseDto;
}

export class DeleteMemberResponseDto {
  @ApiProperty()
  message: string;
}

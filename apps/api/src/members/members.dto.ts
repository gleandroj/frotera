import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum OrganizationRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

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

  @ApiProperty({ description: 'Role in the organization', enum: [OrganizationRole.ADMIN, OrganizationRole.MEMBER] })
  @IsEnum(OrganizationRole)
  role: OrganizationRole;

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
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: OrganizationRole })
  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: OrganizationRole })
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

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
}

export class MemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: OrganizationRole })
  role: OrganizationRole;

  @ApiProperty()
  joinedAt: Date;

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
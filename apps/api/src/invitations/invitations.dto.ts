import { IsEmail, IsEnum, IsString, IsOptional, MinLength, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OrganizationRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export class CreateInvitationDto {
  @ApiProperty({
    description: 'Email address of the user to invite',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Role to assign to the invited user',
    enum: Object.values(OrganizationRole),
    example: OrganizationRole.MEMBER,
  })
  @IsEnum(OrganizationRole)
  role: OrganizationRole;

  @ApiProperty({
    description: 'Language code for email translation',
    example: 'en',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string;
}

export class ResendInvitationDto {
  @ApiProperty({
    description: 'ID of the invitation to resend',
    example: 'clg123xyz',
  })
  @IsString()
  invitationId: string;

  @ApiProperty({
    description: 'Language code for email translation',
    example: 'en',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string;
}

export class AcceptInvitationDto {
  @ApiProperty({
    description: 'Invitation token',
    example: 'abc123xyz',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'Password for new user registration (required only for new users)',
    example: 'securepassword123',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({
    description: 'Name of the user (optional)',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}

export class CheckInvitationDto {
  @ApiProperty({
    description: 'Invitation token to check',
    example: 'abc123xyz',
  })
  @IsString()
  token: string;
}

export class InvitationResponseDto {
  @ApiProperty({
    description: 'ID of the invitation',
    example: 'clg123xyz',
  })
  id: string;

  @ApiProperty({
    description: 'Email address of the invited user',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Role assigned to the invited user',
    enum: Object.values(OrganizationRole),
    example: OrganizationRole.MEMBER,
  })
  role: OrganizationRole;

  @ApiProperty({
    description: 'Status of the invitation',
    enum: Object.values(InvitationStatus),
    example: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @ApiProperty({
    description: 'Date when the invitation was created',
    example: '2024-03-20T10:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the invitation expires',
    example: '2024-03-27T10:00:00Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'Whether the invited user is restricted to specific customers',
    example: false,
  })
  customerRestricted: boolean;

  @ApiPropertyOptional({
    description: 'Customers the user will have access to (when customerRestricted)',
    type: 'array',
    items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
  })
  customers?: { id: string; name: string }[];

  @ApiProperty({
    description: 'Information about the user who sent the invitation',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'clg123xyz' },
      email: { type: 'string', example: 'admin@example.com' },
      name: { type: 'string', example: 'Admin User' },
    },
    nullable: true,
  })
  inviter: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

export class InvitationsListResponseDto {
  @ApiProperty({
    description: 'List of invitations',
    type: () => [InvitationResponseDto],
  })
  invitations: InvitationResponseDto[];
}

export class InvitationCheckResponseDto {
  @ApiProperty({
    description: 'Invitation details',
    type: 'object',
    properties: {
      email: { type: 'string', example: 'user@example.com' },
      role: { type: 'string', enum: Object.values(OrganizationRole), example: OrganizationRole.MEMBER },
      expiresAt: { type: 'string', example: '2024-03-27T10:00:00Z' },
      organization: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'clg123xyz' },
          name: { type: 'string', example: 'My Organization' },
          description: { type: 'string', example: 'Organization description' },
        },
      },
      inviter: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'clg123xyz' },
          email: { type: 'string', example: 'admin@example.com' },
          name: { type: 'string', example: 'Admin User' },
        },
        nullable: true,
      },
    },
  })
  invitation: {
    email: string;
    role: OrganizationRole;
    expiresAt: Date;
    customerRestricted: boolean;
    customers?: { id: string; name: string }[];
    organization: {
      id: string;
      name: string;
      description: string | null;
    };
    inviter: {
      id: string;
      email: string;
      name: string | null;
    } | null;
  };

  @ApiProperty({
    description: 'Whether the user already exists in the system',
    example: false,
  })
  userExists: boolean;
}

export class AcceptInvitationResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Invitation accepted successfully',
  })
  message: string;

  @ApiProperty({
    description: 'User information',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'clg123xyz' },
      email: { type: 'string', example: 'user@example.com' },
      name: { type: 'string', example: 'John Doe' },
      role: { type: 'string', enum: Object.values(OrganizationRole), example: OrganizationRole.MEMBER },
      isNewUser: { type: 'boolean', example: true },
    },
  })
  user: {
    id: string;
    email: string;
    name: string | null;
    role: OrganizationRole;
    isNewUser: boolean;
  };

  @ApiProperty({
    description: 'Organization information',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'clg123xyz' },
      name: { type: 'string', example: 'My Organization' },
      description: { type: 'string', example: 'Organization description' },
      slug: { type: 'string', example: 'my-organization' },
      createdAt: { type: 'string', example: '2024-03-20T10:00:00Z' },
    },
  })
  organization: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
  };
}
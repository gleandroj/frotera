import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export enum OrganizationRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: OrganizationRole })
  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}

export class MemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: OrganizationRole })
  role: OrganizationRole;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty()
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  };
}

export class MembersListResponseDto {
  @ApiProperty({ type: [MemberResponseDto] })
  memberships: MemberResponseDto[];
}

export class UpdateMemberResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  member: MemberResponseDto;
}

export class DeleteMemberResponseDto {
  @ApiProperty()
  message: string;
}
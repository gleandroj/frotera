import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { OrganizationRole } from "../members/members.dto";

export class CreateOrganizationDto {
  @ApiProperty({
    description: "Name of the organization",
    example: "My Organization",
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: "Description of the organization",
    example: "A brief description of what this organization does",
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class OrganizationResponseDto {
  @ApiProperty({
    description: "ID of the organization",
    example: "clg123xyz",
  })
  id: string;

  @ApiProperty({
    description: "Name of the organization",
    example: "My Organization",
  })
  name: string;

  @ApiProperty({
    description: "Description of the organization",
    example: "A brief description of what this organization does",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Currency code for the organization",
    example: "USD",
    default: "USD",
  })
  currency: string;

  @ApiProperty({
    description: "Date when the organization was created",
    example: "2024-03-20T10:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Role of the current user in this organization",
    enum: Object.values(OrganizationRole),
    example: OrganizationRole.OWNER,
  })
  role: OrganizationRole;

  @ApiProperty({
    description: "Date when the user joined the organization",
    example: "2024-03-20T10:00:00Z",
  })
  joinedAt: Date;
}

export class OrganizationsListResponseDto {
  @ApiProperty({
    description: "List of organizations",
    type: () => [OrganizationResponseDto],
  })
  organizations: OrganizationResponseDto[];
}

export class UpdateOrganizationDto {
  @ApiProperty({
    description: "Name of the organization",
    example: "My Updated Organization",
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: "Description of the organization",
    example: "An updated description of what this organization does",
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateOrganizationResponseDto {
  @ApiProperty({
    description: "Success message",
    example: "Organization created successfully",
  })
  message: string;

  @ApiProperty({
    description: "Created organization details",
    type: () => OrganizationResponseDto,
  })
  organization: OrganizationResponseDto;
}



export class UpdateOrganizationResponseDto {
  @ApiProperty({
    description: "Success message",
    example: "Organization updated successfully",
  })
  message: string;

  @ApiProperty({
    description: "Updated organization details",
    type: () => OrganizationResponseDto,
  })
  organization: OrganizationResponseDto;
}

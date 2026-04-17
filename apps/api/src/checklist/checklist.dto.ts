import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber,
  IsOptional, IsString, ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ItemType, EntryStatus } from "@prisma/client";

export class ChecklistTemplateItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() label: string;
  @ApiProperty({ enum: ItemType }) @IsEnum(ItemType) type: ItemType;
  @ApiProperty({ default: true }) @IsBoolean() required: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
  @ApiProperty() @IsNumber() order: number;
}

export class CreateChecklistTemplateDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiProperty({ type: [ChecklistTemplateItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistTemplateItemDto)
  items: ChecklistTemplateItemDto[];
}

export class UpdateChecklistTemplateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional({ type: [ChecklistTemplateItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistTemplateItemDto)
  items?: ChecklistTemplateItemDto[];
}

export class ChecklistTemplateItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() templateId: string;
  @ApiProperty() label: string;
  @ApiProperty({ enum: ItemType }) type: ItemType;
  @ApiProperty() required: boolean;
  @ApiProperty({ type: [String] }) options: string[];
  @ApiProperty() order: number;
}

export class ChecklistTemplateResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiProperty() active: boolean;
  @ApiProperty({ type: [ChecklistTemplateItemResponseDto] }) items: ChecklistTemplateItemResponseDto[];
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class ChecklistAnswerInputDto {
  @ApiProperty() @IsString() @IsNotEmpty() itemId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() value?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
}

export class CreateChecklistEntryDto {
  @ApiProperty() @IsString() @IsNotEmpty() templateId: string;
  @ApiProperty() @IsString() @IsNotEmpty() vehicleId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() driverId?: string;
  @ApiProperty({ type: [ChecklistAnswerInputDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistAnswerInputDto)
  answers: ChecklistAnswerInputDto[];
}

export class UpdateChecklistEntryStatusDto {
  @ApiProperty({ enum: EntryStatus }) @IsEnum(EntryStatus) status: EntryStatus;
}

export class ChecklistEntryFilterDto {
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() driverId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() memberId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() templateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(EntryStatus) status?: EntryStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateTo?: string;
}

export class ChecklistAnswerResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() entryId: string;
  @ApiProperty() itemId: string;
  @ApiPropertyOptional() value?: string | null;
  @ApiPropertyOptional() photoUrl?: string | null;
}

export class ChecklistEntryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() templateId: string;
  @ApiProperty() vehicleId: string;
  @ApiPropertyOptional() driverId?: string | null;
  @ApiProperty() memberId: string;
  @ApiProperty({ enum: EntryStatus }) status: EntryStatus;
  @ApiPropertyOptional() completedAt?: string | null;
  @ApiProperty({ type: [ChecklistAnswerResponseDto] }) answers: ChecklistAnswerResponseDto[];
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

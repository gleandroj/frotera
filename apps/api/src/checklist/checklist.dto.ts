import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber,
  IsOptional, IsString, ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ChecklistDriverRequirement, ItemType, EntryStatus } from "@prisma/client";

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
  @ApiProperty() @IsBoolean() vehicleRequired: boolean;
  @ApiProperty({ enum: ChecklistDriverRequirement })
  @IsEnum(ChecklistDriverRequirement)
  driverRequirement: ChecklistDriverRequirement;
  @ApiProperty({ type: [ChecklistTemplateItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistTemplateItemDto)
  items: ChecklistTemplateItemDto[];
}

export class UpdateChecklistTemplateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() vehicleRequired?: boolean;
  @ApiPropertyOptional({ enum: ChecklistDriverRequirement })
  @IsOptional()
  @IsEnum(ChecklistDriverRequirement)
  driverRequirement?: ChecklistDriverRequirement;
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
  @ApiProperty() vehicleRequired: boolean;
  @ApiProperty({ enum: ChecklistDriverRequirement }) driverRequirement: ChecklistDriverRequirement;
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
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() driverId?: string;
  @ApiProperty({ type: [ChecklistAnswerInputDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistAnswerInputDto)
  answers: ChecklistAnswerInputDto[];
}

export class CreatePublicChecklistEntryDto {
  @ApiProperty() @IsString() @IsNotEmpty() organizationId: string;
  @ApiProperty() @IsString() @IsNotEmpty() templateId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleId?: string;
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

/** Query for aggregated checklist entry summary (no status filter). */
export class ChecklistSummaryQueryDto {
  @ApiPropertyOptional({ description: "ISO date/datetime; if omitted with dateTo, lower bound is open until defaults apply" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "ISO date/datetime; if omitted with dateFrom, upper bound is now" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() templateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleId?: string;
}

export class ChecklistSummaryTotalsDto {
  @ApiProperty() total: number;
  @ApiProperty() pending: number;
  @ApiProperty() completed: number;
  @ApiProperty() incomplete: number;
  @ApiProperty({ description: "completed / total (0 if total is 0)" })
  completionRate: number;
}

export class ChecklistSummaryByTemplateDto {
  @ApiProperty() templateId: string;
  @ApiProperty() templateName: string;
  @ApiProperty() total: number;
  @ApiProperty() pending: number;
  @ApiProperty() completed: number;
  @ApiProperty() incomplete: number;
  @ApiProperty() completionRate: number;
}

export class ChecklistSummaryPeriodDto {
  @ApiProperty() dateFrom: string;
  @ApiProperty() dateTo: string;
}

export class ChecklistSummaryResponseDto {
  @ApiProperty({ type: ChecklistSummaryPeriodDto })
  period: ChecklistSummaryPeriodDto;

  @ApiProperty({ type: ChecklistSummaryTotalsDto })
  totals: ChecklistSummaryTotalsDto;

  @ApiProperty({ type: [ChecklistSummaryByTemplateDto] })
  byTemplate: ChecklistSummaryByTemplateDto[];
}

export class ChecklistAnswerResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() entryId: string;
  @ApiPropertyOptional() itemId?: string | null;
  @ApiPropertyOptional() itemLabel?: string | null;
  @ApiPropertyOptional() itemType?: string | null;
  @ApiProperty({ type: [String] }) itemOptions: string[];
  @ApiPropertyOptional() itemRequired?: boolean | null;
  @ApiPropertyOptional() itemOrder?: number | null;
  @ApiPropertyOptional() value?: string | null;
  @ApiPropertyOptional() photoUrl?: string | null;
}

export class ChecklistEntryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() templateId: string;
  @ApiPropertyOptional() templateName?: string | null;
  @ApiPropertyOptional() vehicleId?: string | null;
  @ApiPropertyOptional() vehicleName?: string | null;
  @ApiPropertyOptional() vehiclePlate?: string | null;
  @ApiPropertyOptional() driverId?: string | null;
  @ApiPropertyOptional() driverName?: string | null;
  @ApiProperty() memberId: string;
  @ApiPropertyOptional() memberName?: string | null;
  @ApiProperty({ enum: EntryStatus }) status: EntryStatus;
  @ApiPropertyOptional() completedAt?: string | null;
  @ApiProperty({ type: [ChecklistAnswerResponseDto] }) answers: ChecklistAnswerResponseDto[];
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

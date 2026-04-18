import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from "class-validator";

export class OrganizationFleetDefaultDto {
  @ApiProperty({ nullable: true })
  deviceOfflineThresholdMinutes!: number | null;

  @ApiProperty({ nullable: true })
  defaultSpeedLimitKmh!: number | null;
}

export class CustomerFleetSettingResolvedDto {
  @ApiProperty()
  customerId!: string;

  @ApiProperty({ nullable: true })
  customerName!: string | null;

  @ApiProperty({ nullable: true })
  deviceOfflineThresholdMinutes!: number | null;

  @ApiProperty({ nullable: true })
  defaultSpeedLimitKmh!: number | null;
}

export class ListCustomerFleetSettingsResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      "Padrão organization-wide (customerId null). Visível apenas a superadmin ou membros sem restrição de empresas.",
  })
  organizationDefault!: OrganizationFleetDefaultDto | null;

  @ApiProperty({ type: [CustomerFleetSettingResolvedDto] })
  customers!: CustomerFleetSettingResolvedDto[];
}

export class UpdateCustomerFleetSettingsDto {
  @ApiProperty({ enum: ["single", "all_accessible", "organization_default"] })
  @IsIn(["single", "all_accessible", "organization_default"])
  applyMode!: "single" | "all_accessible" | "organization_default";

  @ApiPropertyOptional({
    description: "Obrigatório quando applyMode = single (empresa / customer)",
  })
  @ValidateIf((o) => o.applyMode === "single")
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: "Minutos sem posição; null limpa override neste nível",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10080)
  deviceOfflineThresholdMinutes?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "km/h; null ou 0 limpa (ilimitado herdado)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultSpeedLimitKmh?: number | null;
}

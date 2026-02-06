import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CustomerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiPropertyOptional()
  parentId?: string | null;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ description: "Depth in tree (0 = root)" })
  depth?: number;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class CreateCustomerDto {
  @ApiProperty({ example: "Acme Corp" })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: "Parent customer ID for hierarchy" })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: "Acme Corp Updated" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "Parent customer ID; null for root" })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class CustomersListResponseDto {
  @ApiProperty({ type: () => [CustomerResponseDto] })
  customers: CustomerResponseDto[];
}

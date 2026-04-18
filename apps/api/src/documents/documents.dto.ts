import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum DocumentType {
  CRLV = 'CRLV',
  INSURANCE = 'INSURANCE',
  LICENSE = 'LICENSE',
  INSPECTION = 'INSPECTION',
  OTHER = 'OTHER',
}

export enum DocumentStatus {
  VALID = 'VALID', // expiryDate null OR daysUntilExpiry >= 30
  EXPIRING = 'EXPIRING', // 0 <= daysUntilExpiry < 30
  EXPIRED = 'EXPIRED', // daysUntilExpiry < 0
}

export class CreateDocumentDto {
  @ApiProperty()
  @IsString()
  vehicleId: string;

  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  expiryDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListDocumentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  /** Restringe à subárvore da empresa (intersecção com o acesso do membro). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  /** ISO date string — retorna docs com expiryDate <= este valor */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryBefore?: string;

  /**
   * Filtro de status por vencimento (mesma regra de `calcStatus` no serviço).
   * Só aceita EXPIRING ou EXPIRED; omitir retorna todos (ainda escopados por empresa/veículo).
   */
  @ApiPropertyOptional({ enum: [DocumentStatus.EXPIRING, DocumentStatus.EXPIRED] })
  @IsOptional()
  @IsIn([DocumentStatus.EXPIRING, DocumentStatus.EXPIRED])
  expiryStatus?: DocumentStatus.EXPIRING | DocumentStatus.EXPIRED;
}

export class ExpiringQueryDto {
  /** Número de dias à frente para considerar "vencendo". Default: 30 */
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;
}

export class DocumentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() organizationId: string;
  @ApiProperty() vehicleId: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  customerId: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  vehicleName: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  vehiclePlate: string | null;
  @ApiProperty() createdById: string;
  @ApiProperty({ enum: DocumentType }) type: DocumentType;
  @ApiProperty() title: string;
  @ApiPropertyOptional() fileUrl?: string | null;
  @ApiPropertyOptional() issueDate?: string | null;
  @ApiPropertyOptional() expiryDate?: string | null;
  @ApiPropertyOptional() notes?: string | null;
  @ApiProperty({ enum: DocumentStatus }) status: DocumentStatus;
  /** Dias até o vencimento. Negativo = já vencido. Null quando sem expiryDate. */
  @ApiPropertyOptional({ type: Number, nullable: true })
  daysUntilExpiry: number | null;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class DocumentsListResponseDto {
  @ApiProperty({ type: [DocumentResponseDto] })
  documents: DocumentResponseDto[];
}

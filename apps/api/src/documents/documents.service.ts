import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiCode } from '../common/api-codes.enum';
import {
  CreateDocumentDto,
  DocumentResponseDto,
  DocumentsListResponseDto,
  DocumentStatus,
  DocumentType,
  ListDocumentsQueryDto,
  UpdateDocumentDto,
} from './documents.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ──────────────────────────────────────────

  /** Calcula dias até vencimento. Retorna null se sem expiryDate. */
  private calcDaysUntilExpiry(expiryDate: Date | null): number | null {
    if (!expiryDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    return Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calcStatus(days: number | null): DocumentStatus {
    if (days === null) return DocumentStatus.VALID;
    if (days < 0) return DocumentStatus.EXPIRED;
    if (days < 30) return DocumentStatus.EXPIRING;
    return DocumentStatus.VALID;
  }

  private toResponse(doc: any): DocumentResponseDto {
    const days = this.calcDaysUntilExpiry(doc.expiryDate);
    return {
      id: doc.id,
      organizationId: doc.organizationId,
      vehicleId: doc.vehicleId,
      createdById: doc.createdById,
      type: doc.type as DocumentType,
      title: doc.title,
      fileUrl: doc.fileUrl ?? null,
      issueDate: doc.issueDate?.toISOString() ?? null,
      expiryDate: doc.expiryDate?.toISOString() ?? null,
      notes: doc.notes ?? null,
      status: this.calcStatus(days),
      daysUntilExpiry: days,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  /** Verifica que o vehicle pertence à org (lança NotFoundException se não). */
  private async assertVehicleBelongsToOrg(
    vehicleId: string,
    organizationId: string,
  ): Promise<void> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException(ApiCode.VEHICLE_NOT_FOUND);
  }

  // ── CRUD ─────────────────────────────────────────────

  async list(
    organizationId: string,
    query: ListDocumentsQueryDto,
  ): Promise<DocumentsListResponseDto> {
    const where: Prisma.VehicleDocumentWhereInput = {
      organizationId,
      active: true,
      ...(query.vehicleId && { vehicleId: query.vehicleId }),
      ...(query.type && { type: query.type }),
      ...(query.expiryBefore && {
        expiryDate: { lte: new Date(query.expiryBefore) },
      }),
    };
    const rows = await this.prisma.vehicleDocument.findMany({
      where,
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
    });
    return { documents: rows.map((r) => this.toResponse(r)) };
  }

  async create(
    organizationId: string,
    createdById: string, // OrganizationMember.id
    dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    await this.assertVehicleBelongsToOrg(dto.vehicleId, organizationId);
    const doc = await this.prisma.vehicleDocument.create({
      data: {
        organizationId,
        vehicleId: dto.vehicleId,
        createdById,
        type: dto.type,
        title: dto.title,
        fileUrl: dto.fileUrl ?? null,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        notes: dto.notes ?? null,
      },
    });
    return this.toResponse(doc);
  }

  async getById(
    id: string,
    organizationId: string,
  ): Promise<DocumentResponseDto> {
    const doc = await this.prisma.vehicleDocument.findFirst({
      where: { id, organizationId, active: true },
    });
    if (!doc) throw new NotFoundException(ApiCode.DOCUMENT_NOT_FOUND);
    return this.toResponse(doc);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const existing = await this.prisma.vehicleDocument.findFirst({
      where: { id, organizationId, active: true },
    });
    if (!existing) throw new NotFoundException(ApiCode.DOCUMENT_NOT_FOUND);
    const doc = await this.prisma.vehicleDocument.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.fileUrl !== undefined && { fileUrl: dto.fileUrl }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.issueDate !== undefined && {
          issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        }),
        ...(dto.expiryDate !== undefined && {
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        }),
      },
    });
    return this.toResponse(doc);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const existing = await this.prisma.vehicleDocument.findFirst({
      where: { id, organizationId, active: true },
    });
    if (!existing) throw new NotFoundException(ApiCode.DOCUMENT_NOT_FOUND);
    // Soft delete
    await this.prisma.vehicleDocument.update({
      where: { id },
      data: { active: false },
    });
  }

  async listExpiring(
    organizationId: string,
    days: number = 30,
  ): Promise<DocumentsListResponseDto> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const future = new Date(now);
    future.setDate(future.getDate() + days);

    // Docs com expiryDate entre hoje (inclusive) e hoje+days (inclusive)
    // OU já vencidos (expiryDate < hoje)
    const rows = await this.prisma.vehicleDocument.findMany({
      where: {
        organizationId,
        active: true,
        expiryDate: {
          not: null,
          lte: future, // vence até hoje+days
        },
      },
      orderBy: [{ expiryDate: 'asc' }],
    });
    return { documents: rows.map((r) => this.toResponse(r)) };
  }
}

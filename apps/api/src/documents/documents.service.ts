import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomersService } from '@/customers/customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../utils/s3.service';
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

const DOCUMENT_VEHICLE_INCLUDE = {
  vehicle: {
    select: {
      name: true,
      plate: true,
      customerId: true,
      customer: { select: { id: true, name: true } },
    },
  },
} as const;

const DOCUMENT_UPLOAD_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly customersService: CustomersService,
  ) {}

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
      customerId: doc.vehicle?.customerId ?? null,
      customerName: doc.vehicle?.customer?.name ?? null,
      vehicleName: doc.vehicle?.name ?? null,
      vehiclePlate: doc.vehicle?.plate ?? null,
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

  async uploadAttachment(
    organizationId: string,
    buffer: Buffer,
    originalName: string,
    mimetype: string,
  ): Promise<{ fileUrl: string }> {
    if (!DOCUMENT_UPLOAD_MIME.has(mimetype)) {
      throw new BadRequestException(
        'Tipo de arquivo não permitido. Use PDF, imagem (JPEG, PNG, WebP) ou Word.',
      );
    }
    const prefix = `organizations/${organizationId}/documents`;
    const fileUrl = await this.s3.uploadFile(
      buffer,
      originalName,
      mimetype,
      prefix,
    );
    return { fileUrl };
  }

  private startOfLocalDay(base: Date = new Date()): Date {
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private addLocalDays(base: Date, days: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  }

  private async resolveScopedCustomerIds(
    organizationId: string,
    allowedCustomerIds: string[] | null,
    filterCustomerId?: string | null,
  ): Promise<string[] | null> {
    return this.customersService.resolveResourceCustomerFilter(
      organizationId,
      allowedCustomerIds,
      filterCustomerId?.trim() || undefined,
    );
  }

  private vehicleInScopeWhere(
    organizationId: string,
    scopedCustomerIds: string[] | null,
  ): Prisma.VehicleWhereInput {
    return {
      organizationId,
      ...(scopedCustomerIds !== null
        ? { customerId: { in: scopedCustomerIds } }
        : {}),
    };
  }

  /** Veículo na org e (se restrito) na lista de empresas permitidas. */
  private async assertVehicleInScope(
    vehicleId: string,
    organizationId: string,
    scopedCustomerIds: string[] | null,
  ): Promise<void> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, ...this.vehicleInScopeWhere(organizationId, scopedCustomerIds) },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException(ApiCode.VEHICLE_NOT_FOUND);
  }

  // ── CRUD ─────────────────────────────────────────────

  async list(
    organizationId: string,
    query: ListDocumentsQueryDto,
    allowedCustomerIds: string[] | null,
  ): Promise<DocumentsListResponseDto> {
    const scoped = await this.resolveScopedCustomerIds(
      organizationId,
      allowedCustomerIds,
      query.customerId,
    );

    const startToday = this.startOfLocalDay();
    const expiringUpper = this.addLocalDays(startToday, 30);

    const expiryStatusWhere: Prisma.VehicleDocumentWhereInput | undefined =
      query.expiryStatus === DocumentStatus.EXPIRED
        ? { expiryDate: { not: null, lt: startToday } }
        : query.expiryStatus === DocumentStatus.EXPIRING
          ? {
              expiryDate: {
                not: null,
                gte: startToday,
                lt: expiringUpper,
              },
            }
          : undefined;

    const where: Prisma.VehicleDocumentWhereInput = {
      organizationId,
      active: true,
      vehicle: { is: this.vehicleInScopeWhere(organizationId, scoped) },
      ...(query.vehicleId && { vehicleId: query.vehicleId }),
      ...(query.type && { type: query.type }),
      ...(query.expiryBefore && {
        expiryDate: { lte: new Date(query.expiryBefore) },
      }),
      ...(expiryStatusWhere ?? {}),
    };
    const rows = await this.prisma.vehicleDocument.findMany({
      where,
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
      include: DOCUMENT_VEHICLE_INCLUDE,
    });
    return { documents: rows.map((r) => this.toResponse(r)) };
  }

  async create(
    organizationId: string,
    createdById: string, // OrganizationMember.id
    dto: CreateDocumentDto,
    allowedCustomerIds: string[] | null,
  ): Promise<DocumentResponseDto> {
    const scoped = await this.resolveScopedCustomerIds(
      organizationId,
      allowedCustomerIds,
      null,
    );
    await this.assertVehicleInScope(dto.vehicleId, organizationId, scoped);
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
      include: DOCUMENT_VEHICLE_INCLUDE,
    });
    return this.toResponse(doc);
  }

  async getById(
    id: string,
    organizationId: string,
    allowedCustomerIds: string[] | null,
  ): Promise<DocumentResponseDto> {
    const scoped = await this.resolveScopedCustomerIds(
      organizationId,
      allowedCustomerIds,
      null,
    );
    const doc = await this.prisma.vehicleDocument.findFirst({
      where: {
        id,
        organizationId,
        active: true,
        vehicle: { is: this.vehicleInScopeWhere(organizationId, scoped) },
      },
      include: DOCUMENT_VEHICLE_INCLUDE,
    });
    if (!doc) throw new NotFoundException(ApiCode.DOCUMENT_NOT_FOUND);
    return this.toResponse(doc);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateDocumentDto,
    allowedCustomerIds: string[] | null,
  ): Promise<DocumentResponseDto> {
    const scoped = await this.resolveScopedCustomerIds(
      organizationId,
      allowedCustomerIds,
      null,
    );
    const existing = await this.prisma.vehicleDocument.findFirst({
      where: {
        id,
        organizationId,
        active: true,
        vehicle: { is: this.vehicleInScopeWhere(organizationId, scoped) },
      },
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
      include: DOCUMENT_VEHICLE_INCLUDE,
    });
    return this.toResponse(doc);
  }

  async remove(
    id: string,
    organizationId: string,
    allowedCustomerIds: string[] | null,
  ): Promise<void> {
    const scoped = await this.resolveScopedCustomerIds(
      organizationId,
      allowedCustomerIds,
      null,
    );
    const existing = await this.prisma.vehicleDocument.findFirst({
      where: {
        id,
        organizationId,
        active: true,
        vehicle: { is: this.vehicleInScopeWhere(organizationId, scoped) },
      },
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
    days: number,
    allowedCustomerIds: string[] | null,
    filterCustomerId?: string,
  ): Promise<DocumentsListResponseDto> {
    const scoped = await this.resolveScopedCustomerIds(
      organizationId,
      allowedCustomerIds,
      filterCustomerId,
    );

    const now = this.startOfLocalDay();
    const future = this.addLocalDays(now, days);

    // Docs com expiryDate entre hoje (inclusive) e hoje+days (inclusive)
    // OU já vencidos (expiryDate < hoje)
    const rows = await this.prisma.vehicleDocument.findMany({
      where: {
        organizationId,
        active: true,
        vehicle: { is: this.vehicleInScopeWhere(organizationId, scoped) },
        expiryDate: {
          not: null,
          lte: future, // vence até hoje+days
        },
      },
      orderBy: [{ expiryDate: 'asc' }],
      include: DOCUMENT_VEHICLE_INCLUDE,
    });
    return { documents: rows.map((r) => this.toResponse(r)) };
  }
}

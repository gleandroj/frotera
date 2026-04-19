import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ChecklistDriverRequirement, EntryStatus, ItemType } from "@prisma/client";
import { CustomersService } from "../customers/customers.service";
import { PrismaService } from "../prisma/prisma.service";
import { S3Service } from "../utils/s3.service";
import { ApiCode } from "../common/api-codes.enum";
import {
  assertChecklistUploadMime,
  type ChecklistUploadPurpose,
  CHECKLIST_UPLOAD_MAX_BYTES,
} from "./checklist-upload.mime";
import {
  ChecklistEntryFilterDto, ChecklistEntryResponseDto, ChecklistSummaryQueryDto,
  ChecklistSummaryResponseDto, ChecklistTemplateResponseDto,
  CreateChecklistEntryDto, CreateChecklistTemplateDto, CreatePublicChecklistEntryDto,
  UpdateChecklistEntryStatusDto, UpdateChecklistTemplateDto,
} from "./checklist.dto";

export type CreateEntryOptions = { clientIp?: string | null };

/** Escopo de empresa do membro (OrganizationMemberGuard). */
export type ChecklistOrgAccess = {
  allowedCustomerIds: string[] | null;
  isSuperAdmin: boolean;
};

@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly customersService: CustomersService,
  ) {}

  /** Exposto para validação em controllers (ParseFilePipe não cobre MIME por purpose). */
  static readonly uploadMaxBytes = CHECKLIST_UPLOAD_MAX_BYTES;

  private parseUploadPurpose(raw: string | undefined): ChecklistUploadPurpose {
    const p = (raw ?? "").toLowerCase().trim();
    if (p === "photo" || p === "file" || p === "signature") return p;
    throw new BadRequestException('Parâmetro "purpose" deve ser photo, file ou signature.');
  }

  async uploadForMember(
    organizationId: string,
    userId: string,
    purposeRaw: string | undefined,
    buffer: Buffer,
    originalName: string,
    mimetype: string,
  ): Promise<{ fileUrl: string; originalName: string; mimeType: string }> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException();
    const purpose = this.parseUploadPurpose(purposeRaw);
    assertChecklistUploadMime(purpose, mimetype);
    const prefix = `organizations/${organizationId}/checklist-attachments`;
    const fileUrl = await this.s3.uploadFile(buffer, originalName, mimetype, prefix);
    return { fileUrl, originalName, mimeType: mimetype };
  }

  async uploadForPublicTemplate(
    organizationId: string,
    templateId: string,
    purposeRaw: string | undefined,
    buffer: Buffer,
    originalName: string,
    mimetype: string,
  ): Promise<{ fileUrl: string; originalName: string; mimeType: string }> {
    const tpl = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId, active: true },
      select: { id: true },
    });
    if (!tpl) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);
    const purpose = this.parseUploadPurpose(purposeRaw);
    assertChecklistUploadMime(purpose, mimetype);
    const prefix = `organizations/${organizationId}/checklist-attachments`;
    const fileUrl = await this.s3.uploadFile(buffer, originalName, mimetype, prefix);
    return { fileUrl, originalName, mimeType: mimetype };
  }

  private enrichSignatureValue(value: string | undefined | null, clientIp: string | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith("{")) return trimmed;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && parsed.version === 1) {
        return JSON.stringify({
          ...parsed,
          server: {
            ip: clientIp,
            recordedAt: new Date().toISOString(),
          },
        });
      }
    } catch {
      /* keep raw */
    }
    return trimmed;
  }

  async getMemberIdForUser(organizationId: string, userId: string): Promise<string> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException();
    return member.id;
  }

  /** IDs de empresa dona de template visíveis (inclui ancestrais para templates “da matriz”). */
  private async templateCustomerIdsForScope(
    organizationId: string,
    allowedCustomerIds: string[] | null,
    filterCustomerId?: string | null,
  ): Promise<string[] | null> {
    if (allowedCustomerIds === null && !filterCustomerId) {
      return null;
    }
    const leaves = await this.customersService.resolveResourceCustomerFilter(
      organizationId,
      allowedCustomerIds,
      filterCustomerId ?? undefined,
    );
    if (leaves === null) {
      return null;
    }
    if (leaves.length === 0) {
      return [];
    }
    const out = new Set<string>();
    for (const leaf of leaves) {
      const chain = await this.customersService.getCustomerIdAndAncestorIds(
        leaf,
        organizationId,
      );
      for (const id of chain) {
        out.add(id);
      }
    }
    return [...out];
  }

  private async assertTemplateCustomerReadable(
    organizationId: string,
    templateCustomerId: string,
    access: ChecklistOrgAccess,
  ): Promise<void> {
    if (access.isSuperAdmin) {
      return;
    }
    const ids = await this.templateCustomerIdsForScope(
      organizationId,
      access.allowedCustomerIds,
      undefined,
    );
    if (ids === null) {
      return;
    }
    if (!ids.includes(templateCustomerId)) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
  }

  private async assertVehicleUnderTemplateCustomer(
    organizationId: string,
    templateCustomerId: string,
    vehicleCustomerId: string | null,
  ): Promise<void> {
    if (!vehicleCustomerId) {
      return;
    }
    const descendants = await this.customersService.getDescendantCustomerIds(
      [templateCustomerId],
      organizationId,
    );
    const ok = new Set([templateCustomerId, ...descendants]);
    if (!ok.has(vehicleCustomerId)) {
      throw new BadRequestException(ApiCode.CHECKLIST_VEHICLE_NOT_FOUND);
    }
  }

  private async assertDriverUnderTemplateCustomer(
    organizationId: string,
    templateCustomerId: string,
    driverCustomerId: string | null,
  ): Promise<void> {
    if (!driverCustomerId) {
      return;
    }
    const descendants = await this.customersService.getDescendantCustomerIds(
      [templateCustomerId],
      organizationId,
    );
    const ok = new Set([templateCustomerId, ...descendants]);
    if (!ok.has(driverCustomerId)) {
      throw new BadRequestException(ApiCode.DRIVER_NOT_FOUND);
    }
  }

  private assertWriteCustomerId(customerId: string, access: ChecklistOrgAccess): void {
    if (access.isSuperAdmin) {
      return;
    }
    const allowed = access.allowedCustomerIds;
    if (allowed === null) {
      return;
    }
    if (!allowed.includes(customerId)) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
  }

  async listTemplates(
    organizationId: string,
    access: ChecklistOrgAccess,
    filterCustomerId?: string,
  ): Promise<ChecklistTemplateResponseDto[]> {
    const ids = await this.templateCustomerIdsForScope(
      organizationId,
      access.allowedCustomerIds,
      filterCustomerId,
    );
    let where: Prisma.ChecklistTemplateWhereInput = { organizationId };
    if (ids !== null) {
      if (ids.length === 0) {
        return [];
      }
      where = { organizationId, customerId: { in: ids } };
    }
    const templates = await this.prisma.checklistTemplate.findMany({
      where,
      include: {
        items: { orderBy: { order: "asc" } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return templates.map(this.toTemplateResponse);
  }

  async createTemplate(
    organizationId: string,
    dto: CreateChecklistTemplateDto,
    access: ChecklistOrgAccess,
  ): Promise<ChecklistTemplateResponseDto> {
    const customerId = dto.customerId?.trim();
    if (!customerId) {
      throw new BadRequestException("customerId is required");
    }
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    this.assertWriteCustomerId(customerId, access);

    const template = await this.prisma.checklistTemplate.create({
      data: {
        organizationId,
        customerId,
        name: dto.name,
        description: dto.description,
        active: dto.active ?? true,
        vehicleRequired: dto.vehicleRequired,
        driverRequirement: dto.driverRequirement,
        items: {
          create: dto.items.map((item) => ({
            label: item.label,
            type: item.type,
            required: item.required,
            options: item.options ?? [],
            order: item.order,
          })),
        },
      },
      include: {
        items: { orderBy: { order: "asc" } },
        customer: { select: { id: true, name: true } },
      },
    });
    return this.toTemplateResponse(template);
  }

  async getTemplate(
    templateId: string,
    organizationId: string,
    access: ChecklistOrgAccess,
  ): Promise<ChecklistTemplateResponseDto> {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId },
      include: {
        items: { orderBy: { order: "asc" } },
        customer: { select: { id: true, name: true } },
      },
    });
    if (!template) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);
    await this.assertTemplateCustomerReadable(
      organizationId,
      template.customerId,
      access,
    );
    return this.toTemplateResponse(template);
  }

  async updateTemplate(
    templateId: string,
    organizationId: string,
    dto: UpdateChecklistTemplateDto,
    access: ChecklistOrgAccess,
  ): Promise<ChecklistTemplateResponseDto> {
    const existing = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId },
    });
    if (!existing) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);
    await this.assertTemplateCustomerReadable(
      organizationId,
      existing.customerId,
      access,
    );

    return this.prisma.$transaction(async (tx) => {
      const template = await tx.checklistTemplate.update({
        where: { id: templateId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.active !== undefined && { active: dto.active }),
          ...(dto.vehicleRequired !== undefined && { vehicleRequired: dto.vehicleRequired }),
          ...(dto.driverRequirement !== undefined && { driverRequirement: dto.driverRequirement }),
          ...(dto.items !== undefined && {
            items: {
              deleteMany: {},
              create: dto.items.map((item) => ({
                label: item.label, type: item.type, required: item.required,
                options: item.options ?? [], order: item.order,
              })),
            },
          }),
        },
        include: {
          items: { orderBy: { order: "asc" } },
          customer: { select: { id: true, name: true } },
        },
      });
      return this.toTemplateResponse(template);
    });
  }

  async deleteTemplate(
    templateId: string,
    organizationId: string,
    access: ChecklistOrgAccess,
  ): Promise<{ message: string }> {
    const existing = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId },
      include: { entries: { take: 1 } },
    });
    if (!existing) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);
    await this.assertTemplateCustomerReadable(
      organizationId,
      existing.customerId,
      access,
    );

    if (existing.entries.length > 0) {
      await this.prisma.checklistTemplate.update({ where: { id: templateId }, data: { active: false } });
      return { message: "CHECKLIST_TEMPLATE_DEACTIVATED" };
    }
    await this.prisma.checklistTemplate.delete({ where: { id: templateId } });
    return { message: "CHECKLIST_TEMPLATE_DELETED" };
  }

  async listEntries(
    organizationId: string,
    filters: ChecklistEntryFilterDto,
    access: ChecklistOrgAccess,
  ): Promise<ChecklistEntryResponseDto[]> {
    const templateIds = await this.templateCustomerIdsForScope(
      organizationId,
      access.allowedCustomerIds,
      filters.customerId,
    );
    const where: Prisma.ChecklistEntryWhereInput = { organizationId };
    if (templateIds !== null) {
      if (templateIds.length === 0) {
        return [];
      }
      where.template = { is: { customerId: { in: templateIds } } };
    }
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.driverId) where.driverId = filters.driverId;
    if (filters.memberId) where.memberId = filters.memberId;
    if (filters.templateId) where.templateId = filters.templateId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
      };
    }
    const entries = await this.prisma.checklistEntry.findMany({
      where,
      include: {
        answers: true,
        template: {
          select: {
            name: true,
            customer: { select: { name: true } },
          },
        },
        vehicle: { select: { name: true, plate: true } },
        member: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const driverIds = [...new Set(entries.map((e) => e.driverId).filter(Boolean))] as string[];
    const driversFound = driverIds.length > 0
      ? await this.prisma.driver.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } })
      : [];
    const driverMap = new Map(driversFound.map((d) => [d.id, d.name]));

    return entries.map((e) => this.toEntryResponse(e, driverMap.get(e.driverId ?? "") ?? null));
  }

  /**
   * Aggregated entry counts for reporting (no answer payloads).
   * When both dateFrom and dateTo are omitted, defaults to the last 30 days ending now.
   */
  async getEntriesSummary(
    organizationId: string,
    query: ChecklistSummaryQueryDto,
    access: ChecklistOrgAccess,
  ): Promise<ChecklistSummaryResponseDto> {
    const now = new Date();
    let periodFrom: Date;
    let periodTo: Date;

    if (!query.dateFrom && !query.dateTo) {
      periodTo = now;
      periodFrom = new Date(periodTo.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (query.dateFrom && query.dateTo) {
      periodFrom = new Date(query.dateFrom);
      periodTo = new Date(query.dateTo);
    } else if (query.dateFrom) {
      periodFrom = new Date(query.dateFrom);
      periodTo = now;
    } else {
      periodTo = new Date(query.dateTo!);
      periodFrom = new Date(periodTo.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const templateCustomerScopeIds = await this.templateCustomerIdsForScope(
      organizationId,
      access.allowedCustomerIds,
      query.customerId,
    );
    if (templateCustomerScopeIds !== null && templateCustomerScopeIds.length === 0) {
      return {
        period: {
          dateFrom: periodFrom.toISOString(),
          dateTo: periodTo.toISOString(),
        },
        totals: {
          total: 0,
          pending: 0,
          completed: 0,
          incomplete: 0,
          completionRate: 0,
        },
        byTemplate: [],
      };
    }

    const where: Prisma.ChecklistEntryWhereInput = {
      organizationId,
      createdAt: { gte: periodFrom, lte: periodTo },
    };
    if (templateCustomerScopeIds !== null) {
      where.template = {
        is: { customerId: { in: templateCustomerScopeIds } },
      };
    }
    if (query.templateId) where.templateId = query.templateId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;

    const countByStatus = await this.prisma.checklistEntry.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });

    const byTemplateStatus = await this.prisma.checklistEntry.groupBy({
      by: ["templateId", "status"],
      where,
      _count: { _all: true },
    });

    const statusTotals = (s: EntryStatus): number => {
      const row = countByStatus.find((r) => r.status === s);
      return row?._count._all ?? 0;
    };

    const pending = statusTotals(EntryStatus.PENDING);
    const completed = statusTotals(EntryStatus.COMPLETED);
    const incomplete = statusTotals(EntryStatus.INCOMPLETE);
    const total = pending + completed + incomplete;
    const completionRate = total === 0 ? 0 : completed / total;

    const aggregatedTemplateIds = [...new Set(byTemplateStatus.map((r) => r.templateId))];
    const templates = aggregatedTemplateIds.length
      ? await this.prisma.checklistTemplate.findMany({
          where: { id: { in: aggregatedTemplateIds }, organizationId },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(templates.map((t) => [t.id, t.name]));

    const templateAgg = new Map<
      string,
      { pending: number; completed: number; incomplete: number }
    >();
    for (const row of byTemplateStatus) {
      const tid = row.templateId;
      if (!templateAgg.has(tid)) {
        templateAgg.set(tid, { pending: 0, completed: 0, incomplete: 0 });
      }
      const agg = templateAgg.get(tid)!;
      const c = row._count._all;
      if (row.status === EntryStatus.PENDING) agg.pending += c;
      else if (row.status === EntryStatus.COMPLETED) agg.completed += c;
      else if (row.status === EntryStatus.INCOMPLETE) agg.incomplete += c;
    }

    const byTemplate = [...templateAgg.entries()].map(([templateId, counts]) => {
      const t = counts.pending + counts.completed + counts.incomplete;
      return {
        templateId,
        templateName: nameById.get(templateId) ?? templateId,
        total: t,
        pending: counts.pending,
        completed: counts.completed,
        incomplete: counts.incomplete,
        completionRate: t === 0 ? 0 : counts.completed / t,
      };
    });
    byTemplate.sort((a, b) => b.total - a.total);

    return {
      period: {
        dateFrom: periodFrom.toISOString(),
        dateTo: periodTo.toISOString(),
      },
      totals: {
        total,
        pending,
        completed,
        incomplete,
        completionRate,
      },
      byTemplate,
    };
  }

  async createEntry(
    organizationId: string,
    memberId: string,
    dto: CreateChecklistEntryDto,
    access: ChecklistOrgAccess,
    opts?: CreateEntryOptions,
  ): Promise<ChecklistEntryResponseDto> {
    const rawVehicleId = dto.vehicleId?.trim() || undefined;
    const rawDriverId = dto.driverId?.trim() || undefined;

    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: dto.templateId, organizationId, active: true },
      include: { items: true },
    });
    if (!template) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);
    await this.assertTemplateCustomerReadable(
      organizationId,
      template.customerId,
      access,
    );

    const vehicleRequired = template.vehicleRequired;
    const driverReq = template.driverRequirement;

    let resolvedVehicleId: string | null = null;
    if (vehicleRequired) {
      if (!rawVehicleId) throw new BadRequestException(ApiCode.CHECKLIST_VEHICLE_REQUIRED);
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: rawVehicleId, organizationId },
        select: { id: true, customerId: true },
      });
      if (!vehicle) throw new NotFoundException(ApiCode.CHECKLIST_VEHICLE_NOT_FOUND);
      await this.assertVehicleUnderTemplateCustomer(
        organizationId,
        template.customerId,
        vehicle.customerId,
      );
      resolvedVehicleId = vehicle.id;
    } else if (rawVehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: rawVehicleId, organizationId },
        select: { id: true, customerId: true },
      });
      if (!vehicle) throw new NotFoundException(ApiCode.CHECKLIST_VEHICLE_NOT_FOUND);
      await this.assertVehicleUnderTemplateCustomer(
        organizationId,
        template.customerId,
        vehicle.customerId,
      );
      resolvedVehicleId = vehicle.id;
    }

    let resolvedDriverId: string | null = null;
    if (driverReq === ChecklistDriverRequirement.HIDDEN) {
      resolvedDriverId = null;
    } else if (driverReq === ChecklistDriverRequirement.REQUIRED) {
      if (!rawDriverId) throw new BadRequestException(ApiCode.CHECKLIST_DRIVER_REQUIRED);
      const driver = await this.prisma.driver.findFirst({
        where: { id: rawDriverId, organizationId },
        select: { id: true, customerId: true },
      });
      if (!driver) throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);
      await this.assertDriverUnderTemplateCustomer(
        organizationId,
        template.customerId,
        driver.customerId,
      );
      resolvedDriverId = driver.id;
    } else if (rawDriverId) {
      const driver = await this.prisma.driver.findFirst({
        where: { id: rawDriverId, organizationId },
        select: { id: true, customerId: true },
      });
      if (!driver) throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);
      await this.assertDriverUnderTemplateCustomer(
        organizationId,
        template.customerId,
        driver.customerId,
      );
      resolvedDriverId = driver.id;
    }

    const answeredItemIds = new Set(dto.answers.map((a) => a.itemId));
    const templateItemIds = new Set(template.items.map((i) => i.id));

    const invalidItems = dto.answers.filter((a) => !templateItemIds.has(a.itemId));
    if (invalidItems.length > 0) throw new BadRequestException(ApiCode.CHECKLIST_INVALID_ITEM_ID);

    const missingRequired = template.items.filter((i) => i.required && !answeredItemIds.has(i.id));
    if (missingRequired.length > 0) throw new BadRequestException(ApiCode.CHECKLIST_REQUIRED_ITEMS_MISSING);

    const allAnswered = template.items.every((i) => answeredItemIds.has(i.id));
    const status = allAnswered ? "COMPLETED" : "INCOMPLETE";

    const itemMap = new Map(template.items.map((i) => [i.id, i]));
    const clientIp = opts?.clientIp ?? null;

    const entry = await this.prisma.checklistEntry.create({
      data: {
        organizationId,
        templateId: dto.templateId,
        vehicleId: resolvedVehicleId ?? undefined,
        driverId: resolvedDriverId ?? undefined,
        memberId,
        status,
        completedAt: status === "COMPLETED" ? new Date() : null,
        answers: {
          create: dto.answers.map((a) => {
            const item = itemMap.get(a.itemId)!;
            const valueStored =
              item.type === ItemType.SIGNATURE
                ? this.enrichSignatureValue(a.value, clientIp)
                : (a.value ?? null);
            return {
              itemId: a.itemId,
              itemLabel: item.label,
              itemType: item.type as string,
              itemOptions: item.options ?? [],
              itemRequired: item.required,
              itemOrder: item.order,
              value: valueStored,
              photoUrl: a.photoUrl ?? null,
            };
          }),
        },
      },
      include: {
        answers: true,
        template: {
          select: {
            name: true,
            customer: { select: { name: true } },
          },
        },
        vehicle: { select: { name: true, plate: true } },
        member: { include: { user: { select: { name: true, email: true } } } },
      },
    });
    let driverName: string | null = null;
    if (entry.driverId) {
      const driver = await this.prisma.driver.findFirst({
        where: { id: entry.driverId, organizationId },
        select: { name: true },
      });
      driverName = driver?.name ?? null;
    }
    return this.toEntryResponse(entry, driverName);
  }

  async getEntry(
    entryId: string,
    organizationId: string,
    access: ChecklistOrgAccess,
  ): Promise<ChecklistEntryResponseDto> {
    const entry = await this.prisma.checklistEntry.findFirst({
      where: { id: entryId, organizationId },
      include: {
        answers: true,
        template: {
          select: {
            name: true,
            customerId: true,
            customer: { select: { name: true } },
          },
        },
        vehicle: { select: { name: true, plate: true } },
        member: { include: { user: { select: { name: true, email: true } } } },
      },
    });
    if (!entry) throw new NotFoundException(ApiCode.CHECKLIST_ENTRY_NOT_FOUND);
    await this.assertTemplateCustomerReadable(
      organizationId,
      entry.template.customerId,
      access,
    );

    let driverName: string | null = null;
    if (entry.driverId) {
      const driver = await this.prisma.driver.findFirst({
        where: { id: entry.driverId, organizationId },
        select: { name: true },
      });
      driverName = driver?.name ?? entry.driverId;
    }
    return this.toEntryResponse(entry, driverName);
  }

  async updateEntryStatus(
    entryId: string,
    organizationId: string,
    dto: UpdateChecklistEntryStatusDto,
    access: ChecklistOrgAccess,
  ): Promise<ChecklistEntryResponseDto> {
    const existing = await this.prisma.checklistEntry.findFirst({
      where: { id: entryId, organizationId },
      include: {
        answers: true,
        template: { select: { customerId: true } },
      },
    });
    if (!existing) throw new NotFoundException(ApiCode.CHECKLIST_ENTRY_NOT_FOUND);
    await this.assertTemplateCustomerReadable(
      organizationId,
      existing.template.customerId,
      access,
    );

    const entry = await this.prisma.checklistEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        completedAt: dto.status === "COMPLETED" ? new Date() : existing.completedAt,
      },
      include: {
        answers: true,
        template: {
          select: {
            name: true,
            customer: { select: { name: true } },
          },
        },
        vehicle: { select: { name: true, plate: true } },
        member: { include: { user: { select: { name: true, email: true } } } },
      },
    });
    let driverName: string | null = null;
    if (entry.driverId) {
      const driver = await this.prisma.driver.findFirst({
        where: { id: entry.driverId, organizationId },
        select: { name: true },
      });
      driverName = driver?.name ?? null;
    }
    return this.toEntryResponse(entry, driverName);
  }

  async createPublicEntry(
    dto: CreatePublicChecklistEntryDto,
    opts?: CreateEntryOptions,
  ): Promise<ChecklistEntryResponseDto> {
    const fallbackMember = await this.prisma.organizationMember.findFirst({
      where: { organizationId: dto.organizationId },
      orderBy: { createdAt: "asc" },
    });
    if (!fallbackMember) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);

    const publicAccess: ChecklistOrgAccess = {
      allowedCustomerIds: null,
      isSuperAdmin: true,
    };
    return this.createEntry(
      dto.organizationId,
      fallbackMember.id,
      {
        templateId: dto.templateId,
        ...(dto.vehicleId !== undefined && { vehicleId: dto.vehicleId }),
        ...(dto.driverId !== undefined && { driverId: dto.driverId }),
        answers: dto.answers,
      },
      publicAccess,
      opts,
    );
  }

  async getPublicTemplate(organizationId: string, templateId: string): Promise<ChecklistTemplateResponseDto> {
    return this.getTemplate(templateId, organizationId, {
      allowedCustomerIds: null,
      isSuperAdmin: true,
    });
  }

  async listPublicVehicles(organizationId: string) {
    return this.prisma.vehicle.findMany({
      where: { organizationId },
      select: { id: true, name: true, plate: true },
      orderBy: { name: "asc" },
    });
  }

  async listPublicDrivers(organizationId: string) {
    return this.prisma.driver.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  private toTemplateResponse(t: any): ChecklistTemplateResponseDto {
    return {
      id: t.id,
      organizationId: t.organizationId,
      customerId: t.customerId,
      customerName: t.customer?.name ?? null,
      name: t.name,
      description: t.description, active: t.active,
      vehicleRequired: t.vehicleRequired,
      driverRequirement: t.driverRequirement,
      items: (t.items ?? []).map((i: any) => ({
        id: i.id, templateId: i.templateId, label: i.label,
        type: i.type, required: i.required, options: i.options ?? [], order: i.order,
      })),
      createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    };
  }

  private toEntryResponse(e: any, driverName?: string | null): ChecklistEntryResponseDto {
    return {
      id: e.id, organizationId: e.organizationId, templateId: e.templateId,
      templateName: e.template?.name ?? null,
      customerName: e.template?.customer?.name ?? null,
      vehicleId: e.vehicleId,
      vehicleName: e.vehicle?.name ?? null,
      vehiclePlate: e.vehicle?.plate ?? null,
      driverId: e.driverId,
      driverName: driverName ?? null,
      memberId: e.memberId,
      memberName: e.member?.user?.name ?? e.member?.user?.email ?? null,
      status: e.status, completedAt: e.completedAt?.toISOString() ?? null,
      answers: (e.answers ?? []).map((a: any) => ({
        id: a.id, entryId: a.entryId, itemId: a.itemId,
        itemLabel: a.itemLabel ?? null, itemType: a.itemType ?? null,
        itemOptions: a.itemOptions ?? [], itemRequired: a.itemRequired ?? null,
        itemOrder: a.itemOrder ?? null,
        value: a.value, photoUrl: a.photoUrl,
      })),
      createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString(),
    };
  }
}

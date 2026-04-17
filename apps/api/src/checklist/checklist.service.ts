import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApiCode } from "../common/api-codes.enum";
import {
  ChecklistEntryFilterDto, ChecklistEntryResponseDto, ChecklistTemplateResponseDto,
  CreateChecklistEntryDto, CreateChecklistTemplateDto, UpdateChecklistEntryStatusDto,
  UpdateChecklistTemplateDto,
} from "./checklist.dto";

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates(organizationId: string): Promise<ChecklistTemplateResponseDto[]> {
    const templates = await this.prisma.checklistTemplate.findMany({
      where: { organizationId },
      include: { items: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return templates.map(this.toTemplateResponse);
  }

  async createTemplate(organizationId: string, dto: CreateChecklistTemplateDto): Promise<ChecklistTemplateResponseDto> {
    const template = await this.prisma.checklistTemplate.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        active: dto.active ?? true,
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
      include: { items: { orderBy: { order: "asc" } } },
    });
    return this.toTemplateResponse(template);
  }

  async getTemplate(templateId: string, organizationId: string): Promise<ChecklistTemplateResponseDto> {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId },
      include: { items: { orderBy: { order: "asc" } } },
    });
    if (!template) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);
    return this.toTemplateResponse(template);
  }

  async updateTemplate(templateId: string, organizationId: string, dto: UpdateChecklistTemplateDto): Promise<ChecklistTemplateResponseDto> {
    const existing = await this.prisma.checklistTemplate.findFirst({ where: { id: templateId, organizationId } });
    if (!existing) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);

    const template = await this.prisma.checklistTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.active !== undefined && { active: dto.active }),
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
      include: { items: { orderBy: { order: "asc" } } },
    });
    return this.toTemplateResponse(template);
  }

  async deleteTemplate(templateId: string, organizationId: string): Promise<{ message: string }> {
    const existing = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId },
      include: { entries: { take: 1 } },
    });
    if (!existing) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);

    if (existing.entries.length > 0) {
      await this.prisma.checklistTemplate.update({ where: { id: templateId }, data: { active: false } });
      return { message: "CHECKLIST_TEMPLATE_DEACTIVATED" };
    }
    await this.prisma.checklistTemplate.delete({ where: { id: templateId } });
    return { message: "CHECKLIST_TEMPLATE_DELETED" };
  }

  async listEntries(organizationId: string, filters: ChecklistEntryFilterDto): Promise<ChecklistEntryResponseDto[]> {
    const where: Record<string, unknown> = { organizationId };
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
      where, include: { answers: true }, orderBy: { createdAt: "desc" },
    });
    return entries.map(this.toEntryResponse);
  }

  async createEntry(organizationId: string, memberId: string, dto: CreateChecklistEntryDto): Promise<ChecklistEntryResponseDto> {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: dto.templateId, organizationId, active: true },
      include: { items: true },
    });
    if (!template) throw new NotFoundException(ApiCode.CHECKLIST_TEMPLATE_NOT_FOUND);

    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: dto.vehicleId, organizationId } });
    if (!vehicle) throw new NotFoundException(ApiCode.CHECKLIST_VEHICLE_NOT_FOUND);

    const answeredItemIds = new Set(dto.answers.map((a) => a.itemId));
    const templateItemIds = new Set(template.items.map((i) => i.id));

    const invalidItems = dto.answers.filter((a) => !templateItemIds.has(a.itemId));
    if (invalidItems.length > 0) throw new BadRequestException(ApiCode.CHECKLIST_INVALID_ITEM_ID);

    const missingRequired = template.items.filter((i) => i.required && !answeredItemIds.has(i.id));
    if (missingRequired.length > 0) throw new BadRequestException(ApiCode.CHECKLIST_REQUIRED_ITEMS_MISSING);

    const allAnswered = template.items.every((i) => answeredItemIds.has(i.id));
    const status = allAnswered ? "COMPLETED" : "INCOMPLETE";

    const entry = await this.prisma.checklistEntry.create({
      data: {
        organizationId,
        templateId: dto.templateId,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId ?? null,
        memberId,
        status,
        completedAt: status === "COMPLETED" ? new Date() : null,
        answers: {
          create: dto.answers.map((a) => ({
            itemId: a.itemId, value: a.value ?? null, photoUrl: a.photoUrl ?? null,
          })),
        },
      },
      include: { answers: true },
    });
    return this.toEntryResponse(entry);
  }

  async getEntry(entryId: string, organizationId: string): Promise<ChecklistEntryResponseDto> {
    const entry = await this.prisma.checklistEntry.findFirst({
      where: { id: entryId, organizationId },
      include: { answers: true },
    });
    if (!entry) throw new NotFoundException(ApiCode.CHECKLIST_ENTRY_NOT_FOUND);
    return this.toEntryResponse(entry);
  }

  async updateEntryStatus(entryId: string, organizationId: string, dto: UpdateChecklistEntryStatusDto): Promise<ChecklistEntryResponseDto> {
    const existing = await this.prisma.checklistEntry.findFirst({
      where: { id: entryId, organizationId }, include: { answers: true },
    });
    if (!existing) throw new NotFoundException(ApiCode.CHECKLIST_ENTRY_NOT_FOUND);

    const entry = await this.prisma.checklistEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        completedAt: dto.status === "COMPLETED" ? new Date() : existing.completedAt,
      },
      include: { answers: true },
    });
    return this.toEntryResponse(entry);
  }

  private toTemplateResponse(t: any): ChecklistTemplateResponseDto {
    return {
      id: t.id, organizationId: t.organizationId, name: t.name,
      description: t.description, active: t.active,
      items: (t.items ?? []).map((i: any) => ({
        id: i.id, templateId: i.templateId, label: i.label,
        type: i.type, required: i.required, options: i.options ?? [], order: i.order,
      })),
      createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    };
  }

  private toEntryResponse(e: any): ChecklistEntryResponseDto {
    return {
      id: e.id, organizationId: e.organizationId, templateId: e.templateId,
      vehicleId: e.vehicleId, driverId: e.driverId, memberId: e.memberId,
      status: e.status, completedAt: e.completedAt?.toISOString() ?? null,
      answers: (e.answers ?? []).map((a: any) => ({
        id: a.id, entryId: a.entryId, itemId: a.itemId, value: a.value, photoUrl: a.photoUrl,
      })),
      createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString(),
    };
  }
}

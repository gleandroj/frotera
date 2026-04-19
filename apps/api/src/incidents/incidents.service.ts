import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { IncidentStatus } from "@prisma/client";
import { ApiCode } from "@/common/api-codes.enum";
import { CustomersService } from "@/customers/customers.service";
import { PrismaService } from "@/prisma/prisma.service";
import { S3Service } from "@/utils/s3.service";
import {
  assertIncidentAttachmentMime,
  INCIDENT_ATTACHMENT_UPLOAD_MAX_BYTES,
} from "./incidents-attachment-upload";
import {
  AddAttachmentDto,
  CreateIncidentDto,
  IncidentFiltersDto,
  UpdateIncidentDto,
} from "./incidents.dto";

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly customersService: CustomersService,
  ) {}

  private async getMember(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!member) throw new ForbiddenException("Not a member of this organization");
    return member;
  }

  private async findOrFail(id: string, organizationId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, organizationId },
      include: {
        attachments: true,
        customer: { select: { id: true, name: true } },
        vehicle: { select: { id: true, name: true, plate: true } },
      },
    });
    if (!incident) throw new NotFoundException("Incident not found");
    return incident;
  }

  private async assertVehicleInOrg(vehicleId: string, organizationId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found in this organization");
  }

  private async assertDriverInOrg(driverId: string, organizationId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, organizationId },
    });
    if (!driver) throw new NotFoundException("Driver not found in this organization");
  }

  private assertIncidentCustomerAccess(
    customerId: string,
    allowedCustomerIds: string[] | null,
  ): void {
    if (allowedCustomerIds === null) return;
    if (!allowedCustomerIds.includes(customerId)) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
  }

  /** Effective customerId filter: member scope ∩ optional subtree filter. */
  private async resolveListCustomerIds(
    organizationId: string,
    allowedCustomerIds: string[] | null,
    filterCustomerId?: string,
  ): Promise<Prisma.StringFilter | undefined> {
    let scope: string[] | null =
      allowedCustomerIds === null ? null : [...allowedCustomerIds];
    if (filterCustomerId) {
      const desc = await this.customersService.getDescendantCustomerIds(
        [filterCustomerId],
        organizationId,
      );
      const sub = new Set([filterCustomerId, ...desc]);
      if (scope === null) {
        scope = [...sub];
      } else {
        scope = scope.filter((id) => sub.has(id));
      }
    }
    if (scope === null) return undefined;
    if (scope.length === 0) return { in: [] };
    return { in: scope };
  }

  private async resolveCustomerIdForCreate(
    organizationId: string,
    dto: CreateIncidentDto,
  ): Promise<string> {
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, organizationId },
        select: { customerId: true },
      });
      if (!vehicle) throw new NotFoundException("Vehicle not found in this organization");
      return vehicle.customerId;
    }
    const driverIdTrimmed = dto.driverId?.trim();
    if (driverIdTrimmed) {
      const driver = await this.prisma.driver.findFirst({
        where: { id: driverIdTrimmed, organizationId },
        select: { customerId: true },
      });
      if (!driver) throw new NotFoundException("Driver not found in this organization");
      return driver.customerId;
    }
    const explicit = dto.customerId?.trim();
    if (!explicit) {
      throw new BadRequestException(
        "customerId is required when the incident has no vehicle and no driver",
      );
    }
    const c = await this.prisma.customer.findFirst({
      where: { id: explicit, organizationId },
    });
    if (!c) throw new NotFoundException("Customer not found in this organization");
    return explicit;
  }

  async list(
    organizationId: string,
    filters: IncidentFiltersDto,
    allowedCustomerIds: string[] | null,
  ) {
    const {
      type,
      status,
      severity,
      vehicleId,
      driverId,
      customerId: filterCustomerId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.IncidentWhereInput = { organizationId };
    if (type) where.type = type;
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (vehicleId) where.vehicleId = vehicleId;
    if (driverId) where.driverId = driverId;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const customerFilter = await this.resolveListCustomerIds(
      organizationId,
      allowedCustomerIds,
      filterCustomerId,
    );
    if (customerFilter) where.customerId = customerFilter;

    const skip = (page - 1) * limit;
    const [incidents, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        include: {
          attachments: true,
          customer: { select: { id: true, name: true } },
          vehicle: { select: { id: true, name: true, plate: true } },
        },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      incidents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(
    userId: string,
    organizationId: string,
    dto: CreateIncidentDto,
    allowedCustomerIds: string[] | null,
  ) {
    const member = await this.getMember(userId, organizationId);

    if (dto.vehicleId) await this.assertVehicleInOrg(dto.vehicleId, organizationId);
    const driverIdTrimmed = dto.driverId?.trim();
    if (driverIdTrimmed) await this.assertDriverInOrg(driverIdTrimmed, organizationId);

    const customerId = await this.resolveCustomerIdForCreate(organizationId, dto);
    this.assertIncidentCustomerAccess(customerId, allowedCustomerIds);

    return this.prisma.incident.create({
      data: {
        organizationId,
        customerId,
        createdById: member.id,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        date: new Date(dto.date),
        location: dto.location,
        severity: dto.severity,
        vehicleId: dto.vehicleId,
        driverId: driverIdTrimmed || undefined,
        cost: dto.cost,
        insuranceClaim: dto.insuranceClaim ?? false,
        claimNumber: dto.claimNumber,
        notes: dto.notes,
        status: IncidentStatus.OPEN,
      },
      include: {
        attachments: true,
        customer: { select: { id: true, name: true } },
        vehicle: { select: { id: true, name: true, plate: true } },
      },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
    allowedCustomerIds: string[] | null,
  ) {
    const incident = await this.findOrFail(id, organizationId);
    this.assertIncidentCustomerAccess(incident.customerId, allowedCustomerIds);
    return incident;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateIncidentDto,
    allowedCustomerIds: string[] | null,
  ) {
    const existing = await this.findOrFail(id, organizationId);
    this.assertIncidentCustomerAccess(existing.customerId, allowedCustomerIds);

    if (dto.vehicleId) await this.assertVehicleInOrg(dto.vehicleId, organizationId);
    if (dto.driverId !== undefined) {
      const d = dto.driverId?.trim();
      if (d) await this.assertDriverInOrg(d, organizationId);
    }

    const data: Prisma.IncidentUncheckedUpdateInput = {};

    if (dto.type !== undefined) data.type = dto.type;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.cost !== undefined) data.cost = dto.cost;
    if (dto.insuranceClaim !== undefined) data.insuranceClaim = dto.insuranceClaim;
    if (dto.claimNumber !== undefined) data.claimNumber = dto.claimNumber;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.vehicleId !== undefined) data.vehicleId = dto.vehicleId;
    if (dto.driverId !== undefined) {
      const d = dto.driverId?.trim();
      data.driverId = d ? d : null;
    }

    if (
      dto.vehicleId !== undefined ||
      dto.driverId !== undefined ||
      dto.customerId !== undefined
    ) {
      const nextVehicleId =
        dto.vehicleId !== undefined ? dto.vehicleId : existing.vehicleId;
      const nextDriverId =
        dto.driverId !== undefined
          ? dto.driverId?.trim() || null
          : existing.driverId;
      const nextCustomerExplicit = dto.customerId?.trim();

      let newCustomerId: string;
      if (nextVehicleId) {
        const vehicle = await this.prisma.vehicle.findFirst({
          where: { id: nextVehicleId, organizationId },
          select: { customerId: true },
        });
        if (!vehicle) throw new NotFoundException("Vehicle not found in this organization");
        newCustomerId = vehicle.customerId;
      } else if (nextDriverId) {
        const driver = await this.prisma.driver.findFirst({
          where: { id: nextDriverId, organizationId },
          select: { customerId: true },
        });
        if (!driver) throw new NotFoundException("Driver not found in this organization");
        newCustomerId = driver.customerId;
      } else if (nextCustomerExplicit) {
        const c = await this.prisma.customer.findFirst({
          where: { id: nextCustomerExplicit, organizationId },
        });
        if (!c) throw new NotFoundException("Customer not found in this organization");
        newCustomerId = nextCustomerExplicit;
      } else {
        newCustomerId = existing.customerId;
      }
      this.assertIncidentCustomerAccess(newCustomerId, allowedCustomerIds);
      data.customerId = newCustomerId;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === IncidentStatus.RESOLVED && existing.resolvedAt == null) {
        data.resolvedAt = new Date();
      }
    }

    return this.prisma.incident.update({
      where: { id },
      data,
      include: {
        attachments: true,
        customer: { select: { id: true, name: true } },
        vehicle: { select: { id: true, name: true, plate: true } },
      },
    });
  }

  async remove(organizationId: string, id: string, allowedCustomerIds: string[] | null) {
    const existing = await this.findOrFail(id, organizationId);
    this.assertIncidentCustomerAccess(existing.customerId, allowedCustomerIds);
    await this.prisma.incident.delete({ where: { id } });
    return { success: true };
  }

  async addAttachment(
    organizationId: string,
    incidentId: string,
    dto: AddAttachmentDto,
    allowedCustomerIds: string[] | null,
  ) {
    const inc = await this.findOrFail(incidentId, organizationId);
    this.assertIncidentCustomerAccess(inc.customerId, allowedCustomerIds);
    return this.prisma.incidentAttachment.create({
      data: {
        incidentId,
        fileUrl: dto.fileUrl,
        fileType: dto.fileType,
        name: dto.name,
      },
    });
  }

  async uploadAttachmentFile(
    organizationId: string,
    incidentId: string,
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    allowedCustomerIds: string[] | null,
  ) {
    const inc = await this.findOrFail(incidentId, organizationId);
    this.assertIncidentCustomerAccess(inc.customerId, allowedCustomerIds);
    assertIncidentAttachmentMime(mimetype);
    if (buffer.length > INCIDENT_ATTACHMENT_UPLOAD_MAX_BYTES) {
      throw new BadRequestException(
        `Arquivo muito grande (máx. ${Math.floor(INCIDENT_ATTACHMENT_UPLOAD_MAX_BYTES / (1024 * 1024))} MB).`,
      );
    }
    const norm = mimetype.toLowerCase().split(";")[0].trim();
    const prefix = `organizations/${organizationId}/incidents/${incidentId}`;
    const fileUrl = await this.s3.uploadFile(buffer, originalName, norm, prefix);
    const safeName = (originalName || "anexo").replace(/[/\\]/g, "").slice(0, 200) || "anexo";
    return this.prisma.incidentAttachment.create({
      data: {
        incidentId,
        fileUrl,
        fileType: norm,
        name: safeName,
      },
    });
  }

  async removeAttachment(
    organizationId: string,
    incidentId: string,
    attachmentId: string,
    allowedCustomerIds: string[] | null,
  ) {
    const inc = await this.findOrFail(incidentId, organizationId);
    this.assertIncidentCustomerAccess(inc.customerId, allowedCustomerIds);
    const attachment = await this.prisma.incidentAttachment.findFirst({
      where: { id: attachmentId, incidentId },
    });
    if (!attachment) throw new NotFoundException("Attachment not found");
    await this.prisma.incidentAttachment.delete({ where: { id: attachmentId } });
    return { success: true };
  }

  async stats(
    organizationId: string,
    dateFrom: string | undefined,
    dateTo: string | undefined,
    allowedCustomerIds: string[] | null,
    filterCustomerId?: string,
  ) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const baseWhere: Prisma.IncidentWhereInput = { organizationId };
    if (dateFrom || dateTo) baseWhere.date = dateFilter;
    const customerFilter = await this.resolveListCustomerIds(
      organizationId,
      allowedCustomerIds,
      filterCustomerId,
    );
    if (customerFilter) baseWhere.customerId = customerFilter;

    const [byType, byStatus, costAgg, openCount] = await Promise.all([
      this.prisma.incident.groupBy({
        by: ["type"],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.incident.groupBy({
        by: ["status"],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.incident.aggregate({
        where: baseWhere,
        _sum: { cost: true },
      }),
      this.prisma.incident.count({
        where: { ...baseWhere, status: IncidentStatus.OPEN },
      }),
    ]);

    return {
      byType: byType.map((r) => ({ type: r.type, count: r._count._all })),
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      totalCost: costAgg._sum.cost ?? 0,
      openCount,
    };
  }
}

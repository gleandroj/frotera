import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { IncidentStatus } from "@prisma/client";
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

  async list(organizationId: string, filters: IncidentFiltersDto) {
    const {
      type,
      status,
      severity,
      vehicleId,
      driverId,
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

    const skip = (page - 1) * limit;
    const [incidents, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        include: {
          attachments: true,
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

  async create(userId: string, organizationId: string, dto: CreateIncidentDto) {
    const member = await this.getMember(userId, organizationId);

    if (dto.vehicleId) await this.assertVehicleInOrg(dto.vehicleId, organizationId);
    const driverIdTrimmed = dto.driverId?.trim();
    if (driverIdTrimmed) await this.assertDriverInOrg(driverIdTrimmed, organizationId);

    return this.prisma.incident.create({
      data: {
        organizationId,
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
      include: { attachments: true },
    });
  }

  async findOne(organizationId: string, id: string) {
    return this.findOrFail(id, organizationId);
  }

  async update(organizationId: string, id: string, dto: UpdateIncidentDto) {
    const existing = await this.findOrFail(id, organizationId);

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

    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === IncidentStatus.RESOLVED && existing.resolvedAt == null) {
        data.resolvedAt = new Date();
      }
    }

    return this.prisma.incident.update({
      where: { id },
      data,
      include: { attachments: true, vehicle: { select: { id: true, name: true, plate: true } } },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findOrFail(id, organizationId);
    await this.prisma.incident.delete({ where: { id } });
    return { success: true };
  }

  async addAttachment(organizationId: string, incidentId: string, dto: AddAttachmentDto) {
    await this.findOrFail(incidentId, organizationId);
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
  ) {
    await this.findOrFail(incidentId, organizationId);
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
  ) {
    await this.findOrFail(incidentId, organizationId);
    const attachment = await this.prisma.incidentAttachment.findFirst({
      where: { id: attachmentId, incidentId },
    });
    if (!attachment) throw new NotFoundException("Attachment not found");
    await this.prisma.incidentAttachment.delete({ where: { id: attachmentId } });
    return { success: true };
  }

  async stats(organizationId: string, dateFrom?: string, dateTo?: string) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const baseWhere: Prisma.IncidentWhereInput = { organizationId };
    if (dateFrom || dateTo) baseWhere.date = dateFilter;

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

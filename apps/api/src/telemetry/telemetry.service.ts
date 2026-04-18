import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  AlertSeverity,
  AlertType,
  GeofenceType,
} from "@prisma/client";
import type { RedisClientType } from "redis";
import { PrismaService } from "@/prisma/prisma.service";
import { TRACKER_REDIS } from "@/trackers/ingress/tracker-redis-writer.service";
import { isPointInZone } from "./geofence.utils";
import type {
  AlertStatsResponseDto,
  CreateGeofenceDto,
  GeofenceResponseDto,
  ListAlertsQueryDto,
  TelemetryAlertResponseDto,
  UpdateGeofenceDto,
} from "./telemetry.dto";

const GEOFENCE_CACHE_PREFIX = "telemetry:geofences:";

function allAlertTypes(): AlertType[] {
  return Object.values(AlertType);
}

function allSeverities(): AlertSeverity[] {
  return Object.values(AlertSeverity);
}

function parseJsonCoordinates(
  type: GeofenceType,
  raw: Record<string, unknown>,
): Prisma.InputJsonValue {
  if (type === GeofenceType.CIRCLE) {
    const center = raw.center as unknown;
    const radiusRaw = raw.radius;
    const radiusKmRaw = raw.radiusKm;
    if (!Array.isArray(center) || center.length !== 2) {
      throw new BadRequestException("coordinates.center must be [lat, lng]");
    }
    const lat = Number(center[0]);
    const lng = Number(center[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException("Invalid center coordinates");
    }
    let radiusMeters: number;
    if (radiusKmRaw !== undefined && radiusKmRaw !== null) {
      const rkm = Number(radiusKmRaw);
      if (!Number.isFinite(rkm) || rkm <= 0) {
        throw new BadRequestException("coordinates.radiusKm must be a positive number");
      }
      radiusMeters = rkm * 1000;
      if (
        typeof radiusRaw === "number" &&
        Number.isFinite(radiusRaw) &&
        Math.abs(radiusRaw - radiusMeters) > 0.01
      ) {
        throw new BadRequestException(
          "coordinates.radius and coordinates.radiusKm disagree; send only one",
        );
      }
    } else if (typeof radiusRaw === "number" && Number.isFinite(radiusRaw)) {
      radiusMeters = radiusRaw;
    } else {
      throw new BadRequestException(
        "coordinates.radius (meters) or coordinates.radiusKm is required",
      );
    }
    if (radiusMeters < 1) {
      throw new BadRequestException("coordinates.radius must be >= 1 meter");
    }
    const test = isPointInZone([lat, lng], {
      type: GeofenceType.CIRCLE,
      coordinates: { center: [lat, lng], radius: radiusMeters },
    });
    if (!test) {
      throw new BadRequestException("Invalid circle geometry");
    }
    return { center: [lat, lng], radius: radiusMeters };
  }
  const points = raw.points as unknown;
  if (!Array.isArray(points) || points.length < 3) {
    throw new BadRequestException(
      "coordinates.points must have at least 3 vertices",
    );
  }
  const poly: [number, number][] = [];
  for (const p of points) {
    if (!Array.isArray(p) || p.length < 2) {
      throw new BadRequestException("Each point must be [lat, lng]");
    }
    const la = Number(p[0]);
    const ln = Number(p[1]);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) {
      throw new BadRequestException("Invalid polygon vertex");
    }
    poly.push([la, ln]);
  }
  return { points: poly };
}

@Injectable()
export class TelemetryService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(TRACKER_REDIS) private readonly redis: RedisClientType | null,
  ) {}

  private async invalidateGeofenceCache(organizationId: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(`${GEOFENCE_CACHE_PREFIX}${organizationId}`);
    } catch {
      /* ignore */
    }
  }

  private async scopedVehicleIds(
    organizationId: string,
    allowedCustomerIds: string[] | null,
  ): Promise<string[] | null> {
    if (allowedCustomerIds === null) return null;
    if (allowedCustomerIds.length === 0) return [];
    const vehicles = await this.prisma.vehicle.findMany({
      where: { organizationId, customerId: { in: allowedCustomerIds } },
      select: { id: true },
    });
    return vehicles.map((v) => v.id);
  }

  private alertVehicleScope(
    scopedVehicleIds: string[] | null,
  ): Prisma.TelemetryAlertWhereInput | null {
    if (scopedVehicleIds === null) return null;
    if (scopedVehicleIds.length === 0) {
      return { id: "__none__" };
    }
    return {
      OR: [
        { vehicleId: { in: scopedVehicleIds } },
        { vehicleId: null },
      ],
    };
  }

  private toAlertDto(
    row: Prisma.TelemetryAlertGetPayload<{
      include: {
        vehicle: { select: { id: true; name: true; plate: true } };
        device: { select: { id: true; imei: true; name: true } };
      };
    }>,
  ): TelemetryAlertResponseDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      vehicleId: row.vehicleId,
      deviceId: row.deviceId,
      type: row.type,
      severity: row.severity,
      message: row.message,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: row.acknowledgedBy,
      createdAt: row.createdAt.toISOString(),
      vehicle: row.vehicle,
      device: row.device,
    };
  }

  private toGeofenceDto(row: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    type: GeofenceType;
    coordinates: Prisma.JsonValue;
    vehicleIds: string[];
    alertOnEnter: boolean;
    alertOnExit: boolean;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): GeofenceResponseDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      description: row.description,
      type: row.type,
      coordinates: row.coordinates as Record<string, unknown>,
      vehicleIds: row.vehicleIds,
      alertOnEnter: row.alertOnEnter,
      alertOnExit: row.alertOnExit,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listAlerts(
    organizationId: string,
    query: ListAlertsQueryDto,
    allowedCustomerIds: string[] | null,
  ): Promise<{ data: TelemetryAlertResponseDto[]; total: number }> {
    const scoped = await this.scopedVehicleIds(organizationId, allowedCustomerIds);
    const vehicleScope = this.alertVehicleScope(scoped);
    if (vehicleScope && "id" in vehicleScope && vehicleScope.id === "__none__") {
      return { data: [], total: 0 };
    }

    const andParts: Prisma.TelemetryAlertWhereInput[] = [
      { organizationId },
    ];
    if (vehicleScope) andParts.push(vehicleScope);
    if (query.vehicleId) {
      if (scoped !== null && !scoped.includes(query.vehicleId)) {
        return { data: [], total: 0 };
      }
      andParts.push({ vehicleId: query.vehicleId });
    }

    const where: Prisma.TelemetryAlertWhereInput = { AND: andParts };
    if (query.type) where.type = query.type;
    if (query.severity) where.severity = query.severity;
    if (query.acknowledged === true) {
      where.acknowledgedAt = { not: null };
    } else if (query.acknowledged === false) {
      where.acknowledgedAt = null;
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    const [total, rows] = await Promise.all([
      this.prisma.telemetryAlert.count({ where }),
      this.prisma.telemetryAlert.findMany({
        where,
        include: {
          vehicle: { select: { id: true, name: true, plate: true } },
          device: { select: { id: true, imei: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
    ]);

    return {
      data: rows.map((r) => this.toAlertDto(r)),
      total,
    };
  }

  async getAlertStats(
    organizationId: string,
    allowedCustomerIds: string[] | null,
  ): Promise<AlertStatsResponseDto> {
    const scoped = await this.scopedVehicleIds(organizationId, allowedCustomerIds);
    const vehicleScope = this.alertVehicleScope(scoped);
    if (vehicleScope && "id" in vehicleScope && vehicleScope.id === "__none__") {
      const emptyType = Object.fromEntries(
        allAlertTypes().map((t) => [t, 0]),
      ) as Record<string, number>;
      const emptySev = Object.fromEntries(
        allSeverities().map((s) => [s, 0]),
      ) as Record<string, number>;
      return {
        total: 0,
        unacknowledged: 0,
        byType: emptyType,
        bySeverity: emptySev,
      };
    }

    const baseWhere: Prisma.TelemetryAlertWhereInput = {
      AND: [{ organizationId }, ...(vehicleScope ? [vehicleScope] : [])],
    };

    const [total, unack, byTypeRows, bySevRows] = await Promise.all([
      this.prisma.telemetryAlert.count({ where: baseWhere }),
      this.prisma.telemetryAlert.count({
        where: { ...baseWhere, acknowledgedAt: null },
      }),
      this.prisma.telemetryAlert.groupBy({
        by: ["type"],
        where: baseWhere,
        _count: true,
      }),
      this.prisma.telemetryAlert.groupBy({
        by: ["severity"],
        where: baseWhere,
        _count: true,
      }),
    ]);

    const byType = Object.fromEntries(allAlertTypes().map((t) => [t, 0])) as Record<
      string,
      number
    >;
    for (const row of byTypeRows) {
      byType[row.type] = row._count;
    }
    const bySeverity = Object.fromEntries(
      allSeverities().map((s) => [s, 0]),
    ) as Record<string, number>;
    for (const row of bySevRows) {
      bySeverity[row.severity] = row._count;
    }

    return { total, unacknowledged: unack, byType, bySeverity };
  }

  async acknowledgeAlert(
    organizationId: string,
    alertId: string,
    memberId: string | null,
  ): Promise<TelemetryAlertResponseDto> {
    const existing = await this.prisma.telemetryAlert.findFirst({
      where: { id: alertId, organizationId },
      include: {
        vehicle: { select: { id: true, name: true, plate: true } },
        device: { select: { id: true, imei: true, name: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException("Alert not found");
    }
    if (existing.acknowledgedAt) {
      return this.toAlertDto(existing);
    }
    const updated = await this.prisma.telemetryAlert.update({
      where: { id: alertId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: memberId,
      },
      include: {
        vehicle: { select: { id: true, name: true, plate: true } },
        device: { select: { id: true, imei: true, name: true } },
      },
    });
    return this.toAlertDto(updated);
  }

  async listGeofences(organizationId: string): Promise<GeofenceResponseDto[]> {
    const rows = await this.prisma.geofenceZone.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
    return rows.map((r) => this.toGeofenceDto(r));
  }

  async createGeofence(
    organizationId: string,
    dto: CreateGeofenceDto,
  ): Promise<GeofenceResponseDto> {
    const coords = parseJsonCoordinates(
      dto.type,
      dto.coordinates as Record<string, unknown>,
    );
    const row = await this.prisma.geofenceZone.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
        coordinates: coords,
        vehicleIds: dto.vehicleIds ?? [],
        alertOnEnter: dto.alertOnEnter ?? true,
        alertOnExit: dto.alertOnExit ?? true,
      },
    });
    await this.invalidateGeofenceCache(organizationId);
    return this.toGeofenceDto(row);
  }

  async updateGeofence(
    organizationId: string,
    id: string,
    dto: UpdateGeofenceDto,
  ): Promise<GeofenceResponseDto> {
    const existing = await this.prisma.geofenceZone.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Geofence not found");

    let coordinates: Prisma.InputJsonValue | undefined;
    const nextType = dto.type ?? existing.type;
    if (dto.coordinates != null) {
      coordinates = parseJsonCoordinates(
        nextType,
        dto.coordinates as Record<string, unknown>,
      );
    }

    const row = await this.prisma.geofenceZone.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.type != null ? { type: dto.type } : {}),
        ...(coordinates !== undefined ? { coordinates } : {}),
        ...(dto.vehicleIds != null ? { vehicleIds: dto.vehicleIds } : {}),
        ...(dto.alertOnEnter != null ? { alertOnEnter: dto.alertOnEnter } : {}),
        ...(dto.alertOnExit != null ? { alertOnExit: dto.alertOnExit } : {}),
        ...(dto.active != null ? { active: dto.active } : {}),
      },
    });
    await this.invalidateGeofenceCache(organizationId);
    return this.toGeofenceDto(row);
  }

  async deleteGeofence(organizationId: string, id: string): Promise<void> {
    const existing = await this.prisma.geofenceZone.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Geofence not found");
    await this.prisma.geofenceZone.delete({ where: { id } });
    await this.invalidateGeofenceCache(organizationId);
  }
}

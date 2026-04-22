import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CustomersService } from '@/customers/customers.service';
import { TripsQueryDto, StopsQueryDto, PositionsReportQueryDto, ReferencePointsProximityQueryDto, ReferencePointProximityRowDto } from './dto/trips-query.dto';

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  async getTrips(organizationId: string, memberId: string, query: TripsQueryDto) {
    const where: any = { organizationId };
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.driverId) where.driverId = query.driverId;
    if (query.from || query.to) {
      where.startedAt = {};
      if (query.from) where.startedAt.gte = new Date(query.from);
      if (query.to) where.startedAt.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.vehicleTrip.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
        include: {
          vehicle: { select: { id: true, name: true, plate: true } },
        },
      }),
      this.prisma.vehicleTrip.count({ where }),
    ]);

    return { items, total };
  }

  async getStops(organizationId: string, query: StopsQueryDto) {
    const where: any = { organizationId };
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.from || query.to) {
      where.startedAt = {};
      if (query.from) where.startedAt.gte = new Date(query.from);
      if (query.to) where.startedAt.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.vehicleStop.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
        include: {
          vehicle: { select: { id: true, name: true, plate: true } },
        },
      }),
      this.prisma.vehicleStop.count({ where }),
    ]);

    return { items, total };
  }

  async getPositions(organizationId: string, memberId: string, query: PositionsReportQueryDto) {
    // Find devices for the org (optionally filtered by vehicle)
    let deviceIds: string[] = [];
    if (query.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: query.vehicleId, organizationId },
        select: { trackerDeviceId: true },
      });
      if (vehicle?.trackerDeviceId) deviceIds = [vehicle.trackerDeviceId];
    } else {
      const devices = await this.prisma.trackerDevice.findMany({
        where: { organizationId },
        select: { id: true },
      });
      deviceIds = devices.map((d) => d.id);
    }

    if (deviceIds.length === 0) return { items: [], total: 0 };

    const dateField = query.dateField ?? 'receivedAt';
    const where: any = { deviceId: { in: deviceIds } };
    if (query.from || query.to) {
      where[dateField] = {};
      if (query.from) where[dateField].gte = new Date(query.from);
      if (query.to) where[dateField].lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.devicePosition.findMany({
        where,
        orderBy: { [dateField]: 'desc' },
        take: query.limit ?? 500,
        skip: query.offset ?? 0,
        include: {
          device: {
            select: {
              id: true,
              vehicle: { select: { id: true, name: true, plate: true } },
            },
          },
        },
      }),
      this.prisma.devicePosition.count({ where }),
    ]);

    return { items, total };
  }

  async getReferencePointsProximityReport(
    organizationId: string,
    memberId: string,
    query: ReferencePointsProximityQueryDto,
  ): Promise<{ data: ReferencePointProximityRowDto[]; total: number; skip: number; take: number }> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) throw new ForbiddenException('Not a member of this organization');

    // Resolve accessible vehicle IDs
    const allowedCustomerIds = await this.customersService.getAllowedCustomerIds(member, organizationId);

    let scopedCustomerIds: string[] | null;
    if (query.customerIds?.length) {
      const subtrees = await Promise.all(
        query.customerIds.map((cId) =>
          this.customersService
            .resolveResourceCustomerFilter(organizationId, allowedCustomerIds, cId)
            .catch(() => [] as string[]),
        ),
      );
      scopedCustomerIds = [...new Set(subtrees.flat().filter((id): id is string => id !== null))];
    } else {
      scopedCustomerIds = await this.customersService.resolveResourceCustomerFilter(
        organizationId, allowedCustomerIds, undefined,
      );
    }

    const vehicleFilter = scopedCustomerIds !== null
      ? { customerId: { in: scopedCustomerIds } }
      : {};

    const orgVehicles = await this.prisma.vehicle.findMany({
      where: { organizationId, ...vehicleFilter },
      select: { id: true, trackerDeviceId: true, name: true, plate: true },
    });

    let vehicles = orgVehicles.filter((v) => v.trackerDeviceId !== null);
    if (query.vehicleIds?.length) {
      const filterSet = new Set(query.vehicleIds);
      vehicles = vehicles.filter((v) => filterSet.has(v.id));
    }

    if (vehicles.length === 0) {
      return { data: [], total: 0, skip: query.skip ?? 0, take: query.take ?? 100 };
    }

    const deviceIds = vehicles.map((v) => v.trackerDeviceId as string);

    // Check reference points exist
    const referencePoints = await this.prisma.referencePoint.findMany({
      where: {
        organizationId,
        active: true,
        ...(query.referencePointIds?.length ? { id: { in: query.referencePointIds } } : {}),
      },
      select: { id: true },
    });

    if (referencePoints.length === 0) {
      return { data: [], total: 0, skip: query.skip ?? 0, take: query.take ?? 100 };
    }

    const rpIds = referencePoints.map((r) => r.id);
    const take = query.take ?? 100;
    const skip = query.skip ?? 0;
    const dateFrom = this.getStartOfDay(query.dateFrom);
    const dateTo = this.getEndOfDay(query.dateTo);
    const maxDist = query.maxDistanceMeters ?? null;

    // Build vehicle/device lookup map for the result
    const vehicleByDeviceId = new Map(vehicles.map((v) => [v.trackerDeviceId as string, v]));

    const rpIdFilter = rpIds.length > 0
      ? Prisma.sql`AND rp.id IN (${Prisma.join(rpIds)})`
      : Prisma.empty;
    const distFilter = maxDist !== null
      ? Prisma.sql`AND closest.distance_meters <= ${maxDist}`
      : Prisma.empty;

    // Use raw SQL with LATERAL JOIN for Haversine distance calculation
    const rows = await this.prisma.$queryRaw<Array<{
      pos_id: string;
      recorded_at: Date;
      latitude: number;
      longitude: number;
      speed: number | null;
      ignition_on: boolean | null;
      device_id: string;
      rp_id: string;
      rp_name: string;
      distance_meters: number;
    }>>(Prisma.sql`
      SELECT
        dp.id             AS pos_id,
        dp."recordedAt"   AS recorded_at,
        dp.latitude,
        dp.longitude,
        dp.speed,
        dp."ignitionOn"   AS ignition_on,
        dp."deviceId"     AS device_id,
        closest.rp_id,
        closest.rp_name,
        closest.distance_meters
      FROM device_positions dp
      JOIN LATERAL (
        SELECT
          rp.id   AS rp_id,
          rp.name AS rp_name,
          (6371000 * acos(
            LEAST(1.0,
              cos(radians(rp.latitude))  * cos(radians(dp.latitude))
              * cos(radians(dp.longitude - rp.longitude))
              + sin(radians(rp.latitude)) * sin(radians(dp.latitude))
            )
          )) AS distance_meters
        FROM reference_points rp
        WHERE rp."organizationId" = ${organizationId}
          AND rp.active = TRUE
          ${rpIdFilter}
        ORDER BY distance_meters ASC
        LIMIT 1
      ) closest ON TRUE
      WHERE dp."deviceId" IN (${Prisma.join(deviceIds)})
        AND dp."recordedAt" >= ${dateFrom}
        AND dp."recordedAt" <= ${dateTo}
        ${distFilter}
      ORDER BY dp."recordedAt" DESC
      LIMIT ${take} OFFSET ${skip}
    `);

    const countRows = await this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM device_positions dp
      JOIN LATERAL (
        SELECT
          (6371000 * acos(
            LEAST(1.0,
              cos(radians(rp.latitude))  * cos(radians(dp.latitude))
              * cos(radians(dp.longitude - rp.longitude))
              + sin(radians(rp.latitude)) * sin(radians(dp.latitude))
            )
          )) AS distance_meters
        FROM reference_points rp
        WHERE rp."organizationId" = ${organizationId}
          AND rp.active = TRUE
          ${rpIdFilter}
        ORDER BY distance_meters ASC
        LIMIT 1
      ) closest ON TRUE
      WHERE dp."deviceId" IN (${Prisma.join(deviceIds)})
        AND dp."recordedAt" >= ${dateFrom}
        AND dp."recordedAt" <= ${dateTo}
        ${distFilter}
    `);

    const total = Number(countRows[0]?.count ?? 0);

    const data: ReferencePointProximityRowDto[] = rows.map((row) => {
      const vehicle = vehicleByDeviceId.get(row.device_id);
      return {
        positionId: row.pos_id,
        recordedAt: row.recorded_at.toISOString(),
        latitude: row.latitude,
        longitude: row.longitude,
        speed: row.speed,
        ignitionOn: row.ignition_on,
        vehicleId: vehicle?.id ?? row.device_id,
        vehicleName: vehicle?.name ?? null,
        vehiclePlate: vehicle?.plate ?? null,
        closestReferencePointId: row.rp_id,
        closestReferencePointName: row.rp_name,
        closestDistanceMeters: Math.round(row.distance_meters),
      };
    });

    return { data, total, skip, take };
  }

  private getStartOfDay(dateInput: string): Date {
    const date = new Date(dateInput);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getEndOfDay(dateInput: string): Date {
    const date = new Date(dateInput);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}

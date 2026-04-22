import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TripsQueryDto, StopsQueryDto, PositionsReportQueryDto } from './dto/trips-query.dto';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

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
}

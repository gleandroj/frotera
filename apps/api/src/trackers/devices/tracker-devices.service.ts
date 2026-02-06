import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { TrackerModel } from "@prisma/client";
import { ApiCode } from "@/common/api-codes.enum";
import { PrismaService } from "@/prisma/prisma.service";
import {
  CreateTrackerDeviceDto,
  TrackerDeviceResponseDto,
  PositionResponseDto,
  PositionHistoryQueryDto,
} from "../dto/index";
import { TrackerRedisWriterService } from "../ingress/tracker-redis-writer.service";

@Injectable()
export class TrackerDevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisWriter: TrackerRedisWriterService,
  ) {}

  async findByImei(imei: string) {
    return this.prisma.trackerDevice.findUnique({
      where: { imei },
      include: { vehicle: true },
    });
  }

  async findById(id: string) {
    const device = await this.prisma.trackerDevice.findUnique({
      where: { id },
      include: { vehicle: true },
    });
    if (!device) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    return device;
  }

  async findByOrganizationAndId(
    organizationId: string,
    deviceId: string,
  ): Promise<TrackerDeviceResponseDto> {
    const device = await this.prisma.trackerDevice.findFirst({
      where: { id: deviceId, organizationId },
      include: { vehicle: true },
    });
    if (!device) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    return this.toDeviceResponse(device);
  }

  async create(
    organizationId: string,
    dto: CreateTrackerDeviceDto,
  ): Promise<TrackerDeviceResponseDto> {
    const existing = await this.prisma.trackerDevice.findUnique({
      where: { imei: dto.imei },
    });
    if (existing) {
      throw new ConflictException("Tracker device with this IMEI already exists");
    }
    const device = await this.prisma.trackerDevice.create({
      data: {
        organizationId,
        imei: dto.imei,
        model: dto.model,
        name: dto.name,
      },
    });
    return this.toDeviceResponse(device);
  }

  /**
   * Auto-register: create TrackerDevice and Vehicle, link them.
   */
  async createDeviceAndVehicle(
    organizationId: string,
    imei: string,
    model: TrackerModel,
  ): Promise<{ deviceId: string; vehicleId: string }> {
    const device = await this.prisma.trackerDevice.create({
      data: { organizationId, imei, model },
    });
    const vehicle = await this.prisma.vehicle.create({
      data: {
        organizationId,
        trackerDeviceId: device.id,
      },
    });
    return { deviceId: device.id, vehicleId: vehicle.id };
  }

  async update(
    id: string,
    data: { name?: string },
  ): Promise<TrackerDeviceResponseDto> {
    const device = await this.prisma.trackerDevice.update({
      where: { id },
      data,
    });
    return this.toDeviceResponse(device);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.trackerDevice.delete({ where: { id } });
  }

  async listByOrganization(organizationId: string): Promise<TrackerDeviceResponseDto[]> {
    const list = await this.prisma.trackerDevice.findMany({
      where: { organizationId },
      include: { vehicle: true },
    });
    return list.map((d) => this.toDeviceResponse(d));
  }

  async getLastPosition(deviceId: string): Promise<PositionResponseDto | null> {
    const fromRedis = await this.redisWriter.getLastPosition(deviceId);
    if (fromRedis) {
      return {
        id: "",
        deviceId,
        latitude: fromRedis.latitude,
        longitude: fromRedis.longitude,
        altitude: fromRedis.altitude ?? null,
        speed: fromRedis.speed ?? null,
        heading: fromRedis.heading ?? null,
        recordedAt: fromRedis.recordedAt,
        createdAt: new Date().toISOString(),
      };
    }
    const last = await this.prisma.devicePosition.findFirst({
      where: { deviceId },
      orderBy: { recordedAt: "desc" },
    });
    return last ? this.toPositionResponse(last) : null;
  }

  async getPositionHistory(
    deviceId: string,
    query: PositionHistoryQueryDto,
  ): Promise<PositionResponseDto[]> {
    const where: { deviceId: string; recordedAt?: { gte?: Date; lte?: Date } } =
      { deviceId };
    if (query.from) where.recordedAt = { ...where.recordedAt, gte: new Date(query.from) };
    if (query.to)
      where.recordedAt = { ...where.recordedAt, lte: new Date(query.to) };
    const limit =
      query.limit != null ? Number(query.limit) : 100;
    const list = await this.prisma.devicePosition.findMany({
      where,
      orderBy: { recordedAt: "desc" },
      take: Number.isInteger(limit) && limit > 0 ? limit : 100,
    });
    return list.map((p) => this.toPositionResponse(p));
  }

  private toDeviceResponse(d: {
    id: string;
    organizationId: string;
    imei: string;
    model: TrackerModel;
    name: string | null;
    connectedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    vehicle?: { id: string } | null;
  }): TrackerDeviceResponseDto {
    return {
      id: d.id,
      organizationId: d.organizationId,
      imei: d.imei,
      model: d.model,
      name: d.name ?? undefined,
      connectedAt: d.connectedAt != null ? d.connectedAt.toISOString() : null,
      vehicleId: d.vehicle?.id,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  private toPositionResponse(p: {
    id: string;
    deviceId: string;
    latitude: number;
    longitude: number;
    altitude: number | null;
    speed: number | null;
    heading: number | null;
    recordedAt: Date;
    createdAt: Date;
  }): PositionResponseDto {
    return {
      id: p.id,
      deviceId: p.deviceId,
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude ?? undefined,
      speed: p.speed ?? undefined,
      heading: p.heading ?? undefined,
      recordedAt: p.recordedAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
    };
  }
}

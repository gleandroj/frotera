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
  UpdateTrackerDeviceDto,
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
        serialSat: dto.serialSat,
        equipmentModel: dto.equipmentModel,
        individualPassword: dto.individualPassword,
        carrier: dto.carrier,
        simCardNumber: dto.simCardNumber,
        cellNumber: dto.cellNumber,
      } as never,
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
    const defaultCustomer =
      (await this.prisma.customer.findFirst({
        where: { organizationId, parentId: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })) ??
      (await this.prisma.customer.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }));
    if (!defaultCustomer) {
      await this.prisma.trackerDevice.delete({ where: { id: device.id } });
      throw new Error(
        `Cannot auto-create vehicle for org ${organizationId}: no customer exists`,
      );
    }
    const vehicle = await this.prisma.vehicle.create({
      data: {
        organizationId,
        customerId: defaultCustomer.id,
        trackerDeviceId: device.id,
      },
    });
    return { deviceId: device.id, vehicleId: vehicle.id };
  }

  async update(
    id: string,
    data: UpdateTrackerDeviceDto,
  ): Promise<TrackerDeviceResponseDto> {
    const updateData: Record<string, string | undefined> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.serialSat !== undefined) updateData.serialSat = data.serialSat;
    if (data.equipmentModel !== undefined) updateData.equipmentModel = data.equipmentModel;
    if (data.individualPassword !== undefined) updateData.individualPassword = data.individualPassword;
    if (data.carrier !== undefined) updateData.carrier = data.carrier;
    if (data.simCardNumber !== undefined) updateData.simCardNumber = data.simCardNumber;
    if (data.cellNumber !== undefined) updateData.cellNumber = data.cellNumber;
    if (data.odometerSource !== undefined) updateData.odometerSource = data.odometerSource;
    const device = await this.prisma.trackerDevice.update({
      where: { id },
      data: updateData,
    });
    return this.toDeviceResponse(device);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.trackerDevice.delete({ where: { id } });
  }

  async resetOdometer(deviceId: string): Promise<void> {
    await this.redisWriter.resetOdometer(deviceId);
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
        ignitionOn: fromRedis.ignitionOn ?? null,
        voltageLevel: fromRedis.voltageLevel ?? null,
        recordedAt: fromRedis.recordedAt,
        receivedAt: fromRedis.receivedAt ?? null,
        odometerKm: fromRedis.odometerKm ?? null,
        city: fromRedis.city ?? null,
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
    serialSat?: string | null;
    equipmentModel?: string | null;
    individualPassword?: string | null;
    carrier?: string | null;
    simCardNumber?: string | null;
    cellNumber?: string | null;
    connectedAt?: Date | null;
    odometerSource?: string;
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
      serialSat: d.serialSat ?? undefined,
      equipmentModel: d.equipmentModel ?? undefined,
      individualPassword: d.individualPassword ?? undefined,
      carrier: d.carrier ?? undefined,
      simCardNumber: d.simCardNumber ?? undefined,
      cellNumber: d.cellNumber ?? undefined,
      connectedAt: d.connectedAt != null ? d.connectedAt.toISOString() : null,
      odometerSource: d.odometerSource ?? undefined,
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
    ignitionOn?: boolean | null;
    recordedAt: Date;
    receivedAt?: Date | null;
    voltageLevel?: number | null;
    odometerKm?: number | null;
    city?: string | null;
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
      ignitionOn: p.ignitionOn ?? null,
      recordedAt: p.recordedAt.toISOString(),
      receivedAt: p.receivedAt?.toISOString() ?? null,
      voltageLevel: p.voltageLevel ?? null,
      odometerKm: p.odometerKm ?? null,
      city: p.city ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  }
}

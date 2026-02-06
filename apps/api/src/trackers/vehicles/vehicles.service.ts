import { Injectable, NotFoundException } from "@nestjs/common";
import type { TrackerModel } from "@prisma/client";
import { ApiCode } from "@/common/api-codes.enum";
import { PrismaService } from "@/prisma/prisma.service";
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleResponseDto,
} from "../dto/index";
import { TrackerDevicesService } from "../devices/tracker-devices.service";

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devicesService: TrackerDevicesService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateVehicleDto,
  ): Promise<VehicleResponseDto> {
    let trackerDeviceId: string | null = dto.trackerDeviceId ?? null;

    if (dto.newDevice) {
      const device = await this.devicesService.create(organizationId, {
        imei: dto.newDevice.imei,
        model: dto.newDevice.model,
        name: dto.newDevice.name,
      });
      trackerDeviceId = device.id;
    }

    const vehicle = await this.prisma.vehicle.create({
      data: {
        organizationId,
        name: dto.name,
        plate: dto.plate,
        trackerDeviceId,
      },
    });
    const withDevice = await this.prisma.vehicle.findUnique({
      where: { id: vehicle.id },
      include: { trackerDevice: true },
    });
    return this.toResponse(withDevice ?? vehicle);
  }

  async update(
    id: string,
    dto: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: {
        name: dto.name,
        plate: dto.plate,
        trackerDeviceId: dto.trackerDeviceId,
      },
    });
    return this.toResponse(vehicle);
  }

  async findById(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { trackerDevice: true },
    });
    if (!vehicle) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    return vehicle;
  }

  async findByOrganizationAndId(
    organizationId: string,
    vehicleId: string,
  ): Promise<VehicleResponseDto> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
      include: { trackerDevice: true },
    });
    if (!vehicle) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    return this.toResponse(vehicle);
  }

  async listByOrganization(
    organizationId: string,
  ): Promise<VehicleResponseDto[]> {
    const list = await this.prisma.vehicle.findMany({
      where: { organizationId },
      include: { trackerDevice: true },
    });
    return list.map((v) => this.toResponse(v));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.vehicle.delete({ where: { id } });
  }

  private toResponse(
    v: {
      id: string;
      organizationId: string;
      name: string | null;
      plate: string | null;
      trackerDeviceId: string | null;
      createdAt: Date;
      updatedAt: Date;
      trackerDevice?: {
        id: string;
        imei: string;
        model: string;
        name: string | null;
        connectedAt?: Date | null;
      } | null;
    },
  ): VehicleResponseDto {
    return {
      id: v.id,
      organizationId: v.organizationId,
      name: v.name ?? undefined,
      plate: v.plate ?? undefined,
      trackerDeviceId: v.trackerDeviceId ?? undefined,
      trackerDevice: v.trackerDevice
        ? {
            id: v.trackerDevice.id,
            imei: v.trackerDevice.imei,
            model: v.trackerDevice.model as TrackerModel,
            name: v.trackerDevice.name ?? undefined,
            connectedAt:
              v.trackerDevice.connectedAt != null
                ? v.trackerDevice.connectedAt.toISOString()
                : null,
          }
        : null,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    };
  }
}

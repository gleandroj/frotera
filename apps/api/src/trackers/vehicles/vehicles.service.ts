import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TrackerModel } from "@prisma/client";
import { ApiCode } from "@/common/api-codes.enum";
import { PrismaService } from "@/prisma/prisma.service";
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleResponseDto,
} from "../dto/index";
import { TrackerDevicesService } from "../devices/tracker-devices.service";

type VehicleWithDevice = Prisma.VehicleGetPayload<{
  include: { trackerDevice: true };
}>;

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
        serialSat: dto.newDevice.serialSat,
        equipmentModel: dto.newDevice.equipmentModel,
        individualPassword: dto.newDevice.individualPassword,
        carrier: dto.newDevice.carrier,
        simCardNumber: dto.newDevice.simCardNumber,
        cellNumber: dto.newDevice.cellNumber,
      });
      trackerDeviceId = device.id;
    }

    const vehicle = await this.prisma.vehicle.create({
      data: {
        organizationId,
        name: dto.name,
        plate: dto.plate,
        serial: dto.serial,
        color: dto.color,
        year: dto.year,
        renavam: dto.renavam,
        chassis: dto.chassis,
        vehicleType: dto.vehicleType,
        inactive: dto.inactive ?? false,
        notes: dto.notes,
        trackerDeviceId,
      },
    });
    const withDevice = await this.prisma.vehicle.findUnique({
      where: { id: vehicle.id },
      include: { trackerDevice: true },
    });
    return this.toResponse((withDevice ?? vehicle) as VehicleWithDevice);
  }

  async update(
    id: string,
    dto: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    const data = Object.fromEntries(
      (Object.entries(dto) as [keyof UpdateVehicleDto, unknown][]).filter(
        ([, value]) => value !== undefined,
      ),
    ) as Prisma.VehicleUncheckedUpdateInput;
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data,
    });
    const withDevice = await this.prisma.vehicle.findUnique({
      where: { id: vehicle.id },
      include: { trackerDevice: true },
    });
    return this.toResponse((withDevice ?? vehicle) as VehicleWithDevice);
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

  private toResponse(v: VehicleWithDevice): VehicleResponseDto {
    return {
      id: v.id,
      organizationId: v.organizationId,
      name: v.name ?? undefined,
      plate: v.plate ?? undefined,
      serial: v.serial ?? undefined,
      color: v.color ?? undefined,
      year: v.year ?? undefined,
      renavam: v.renavam ?? undefined,
      chassis: v.chassis ?? undefined,
      vehicleType: v.vehicleType ?? undefined,
      inactive: v.inactive,
      notes: v.notes ?? undefined,
      trackerDeviceId: v.trackerDeviceId ?? undefined,
      trackerDevice: v.trackerDevice
        ? {
            id: v.trackerDevice.id,
            imei: v.trackerDevice.imei,
            model: v.trackerDevice.model as TrackerModel,
            name: v.trackerDevice.name ?? undefined,
            serialSat: v.trackerDevice.serialSat ?? undefined,
            equipmentModel: v.trackerDevice.equipmentModel ?? undefined,
            carrier: v.trackerDevice.carrier ?? undefined,
            simCardNumber: v.trackerDevice.simCardNumber ?? undefined,
            cellNumber: v.trackerDevice.cellNumber ?? undefined,
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

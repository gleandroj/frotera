import { Injectable, NotFoundException } from "@nestjs/common";
import { ApiCode } from "@/common/api-codes.enum";
import { PrismaService } from "@/prisma/prisma.service";
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleResponseDto,
} from "../dto/index";

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    dto: CreateVehicleDto,
  ): Promise<VehicleResponseDto> {
    const vehicle = await this.prisma.vehicle.create({
      data: {
        organizationId,
        name: dto.name,
        plate: dto.plate,
        trackerDeviceId: dto.trackerDeviceId,
      },
    });
    return this.toResponse(vehicle);
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

  private toResponse(v: {
    id: string;
    organizationId: string;
    name: string | null;
    plate: string | null;
    trackerDeviceId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): VehicleResponseDto {
    return {
      id: v.id,
      organizationId: v.organizationId,
      name: v.name ?? undefined,
      plate: v.plate ?? undefined,
      trackerDeviceId: v.trackerDeviceId ?? undefined,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    };
  }
}

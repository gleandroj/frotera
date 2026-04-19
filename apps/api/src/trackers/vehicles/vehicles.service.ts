import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, TrackerModel } from "@prisma/client";
import { ApiCode } from "@/common/api-codes.enum";
import { PrismaService } from "@/prisma/prisma.service";
import { CustomersService } from "@/customers/customers.service";
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleResponseDto,
} from "../dto/index";
import { TrackerDevicesService } from "../devices/tracker-devices.service";

type VehicleWithDeviceAndCustomer = Prisma.VehicleGetPayload<{
  include: { trackerDevice: true; customer: true };
}>;

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devicesService: TrackerDevicesService,
    private readonly customersService: CustomersService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateVehicleDto,
    allowedCustomerIds: string[] | null,
  ): Promise<VehicleResponseDto> {
    const rawCustomerId = dto.customerId;
    if (
      rawCustomerId == null ||
      (typeof rawCustomerId === "string" && rawCustomerId.trim() === "")
    ) {
      throw new BadRequestException(ApiCode.VEHICLE_CUSTOMER_REQUIRED);
    }
    const customerId = rawCustomerId;
    if (allowedCustomerIds !== null) {
      if (customerId === null) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
      if (!allowedCustomerIds.includes(customerId)) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }

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

    await this.assertPlateUniqueInCustomerHierarchy(
      organizationId,
      customerId,
      dto.plate,
      undefined,
    );

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
        speedLimit: dto.speedLimit ?? undefined,
        initialOdometerKm: dto.initialOdometerKm,
        notes: dto.notes,
        trackerDeviceId,
        customerId,
      },
    });
    const withDevice = await this.prisma.vehicle.findUnique({
      where: { id: vehicle.id },
      include: { trackerDevice: true, customer: true },
    });
    return this.toResponse((withDevice ?? vehicle) as VehicleWithDeviceAndCustomer);
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateVehicleDto,
    allowedCustomerIds: string[] | null,
  ): Promise<VehicleResponseDto> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id, organizationId },
      select: { customerId: true, plate: true },
    });
    if (!existing) throw new NotFoundException(ApiCode.VEHICLE_NOT_FOUND);

    if (dto.customerId !== undefined) {
      const cid = typeof dto.customerId === "string" ? dto.customerId.trim() : "";
      if (!cid) {
        throw new BadRequestException(ApiCode.VEHICLE_CUSTOMER_REQUIRED);
      }
      (dto as { customerId?: string }).customerId = cid;
    }
    if (dto.customerId !== undefined && allowedCustomerIds !== null) {
      if (!allowedCustomerIds.includes(dto.customerId as string)) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }

    const effectiveCustomerId =
      dto.customerId !== undefined ? (dto.customerId as string) : existing.customerId;
    const effectivePlate =
      dto.plate !== undefined ? dto.plate : existing.plate;
    await this.assertPlateUniqueInCustomerHierarchy(
      organizationId,
      effectiveCustomerId,
      effectivePlate,
      id,
    );

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
      include: { trackerDevice: true, customer: true },
    });
    return this.toResponse((withDevice ?? vehicle) as VehicleWithDeviceAndCustomer);
  }

  async findById(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { trackerDevice: true, customer: true },
    });
    if (!vehicle) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    return vehicle;
  }

  async findByOrganizationAndId(
    organizationId: string,
    vehicleId: string,
    allowedCustomerIds: string[] | null,
  ): Promise<VehicleResponseDto> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
      include: { trackerDevice: true, customer: true },
    });
    if (!vehicle) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
    if (allowedCustomerIds !== null) {
      if (!allowedCustomerIds.includes(vehicle.customerId)) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }
    return this.toResponse(vehicle as VehicleWithDeviceAndCustomer);
  }

  async listByOrganization(
    organizationId: string,
    allowedCustomerIds: string[] | null,
    filterCustomerIds?: string[] | null,
    activeOnly?: boolean,
    inactiveOnly?: boolean,
  ): Promise<VehicleResponseDto[]> {
    const where: Prisma.VehicleWhereInput = {
      organizationId,
      ...(activeOnly ? { inactive: false } : {}),
      ...(inactiveOnly ? { inactive: true } : {}),
    };
    const effectiveIds = filterCustomerIds !== undefined && filterCustomerIds !== null
      ? filterCustomerIds
      : allowedCustomerIds;
    if (effectiveIds !== null) {
      if (effectiveIds.length === 0) return [];
      where.customerId = { in: effectiveIds };
    }
    const list = await this.prisma.vehicle.findMany({
      where,
      include: { trackerDevice: true, customer: true },
    });
    return list.map((v) => this.toResponse(v as VehicleWithDeviceAndCustomer));
  }

  async delete(
    id: string,
    allowedCustomerIds: string[] | null,
  ): Promise<void> {
    if (allowedCustomerIds !== null) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id },
        select: { customerId: true },
      });
      if (!vehicle) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);
      if (!allowedCustomerIds.includes(vehicle.customerId)) {
        throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
      }
    }
    await this.prisma.vehicle.delete({ where: { id } });
  }

  /** Placa comparável: trim, maiúsculas, sem espaço/hífen (evita ABC-1234 vs ABC 1234 duplicado). */
  private normalizePlateKey(plate: string | null | undefined): string | null {
    if (plate == null) return null;
    const key = plate.trim().toUpperCase().replace(/[\s-]/g, "");
    return key.length > 0 ? key : null;
  }

  /**
   * Garante que não exista outro veículo com a mesma placa (normalizada) na mesma árvore de
   * customer (raiz + filhos). Raízes diferentes na mesma org podem repetir placa.
   */
  private async assertPlateUniqueInCustomerHierarchy(
    organizationId: string,
    customerId: string,
    plate: string | null | undefined,
    excludeVehicleId: string | undefined,
  ): Promise<void> {
    const plateKey = this.normalizePlateKey(plate);
    if (!plateKey) return;

    const ancestorChain = await this.customersService.getCustomerIdAndAncestorIds(
      customerId,
      organizationId,
    );
    if (ancestorChain.length === 0) {
      throw new BadRequestException(ApiCode.VEHICLE_CUSTOMER_REQUIRED);
    }
    const rootId = ancestorChain[ancestorChain.length - 1]!;
    const descendantIds = await this.customersService.getDescendantCustomerIds(
      [rootId],
      organizationId,
    );
    const customerIdsInTree = new Set<string>([rootId, ...descendantIds]);

    const candidates = await this.prisma.vehicle.findMany({
      where: {
        organizationId,
        customerId: { in: [...customerIdsInTree] },
        id: excludeVehicleId ? { not: excludeVehicleId } : undefined,
      },
      select: { id: true, plate: true },
    });
    for (const v of candidates) {
      if (this.normalizePlateKey(v.plate) === plateKey) {
        throw new BadRequestException(ApiCode.VEHICLE_DUPLICATE_PLATE_IN_CUSTOMER_HIERARCHY);
      }
    }
  }

  private toResponse(v: VehicleWithDeviceAndCustomer): VehicleResponseDto {
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
      speedLimit: v.speedLimit ?? undefined,
      initialOdometerKm: v.initialOdometerKm ?? undefined,
      notes: v.notes ?? undefined,
      trackerDeviceId: v.trackerDeviceId ?? undefined,
      customerId: v.customerId ?? undefined,
      customer: v.customer
        ? { id: v.customer.id, name: v.customer.name }
        : null,
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

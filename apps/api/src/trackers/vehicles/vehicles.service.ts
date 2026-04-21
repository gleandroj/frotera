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
  FleetVehicleStatusDto,
  UpdateVehicleDto,
  VehicleResponseDto,
} from "../dto/index";
import { TrackerDevicesService } from "../devices/tracker-devices.service";

type VehicleWithDeviceAndCustomer = Prisma.VehicleGetPayload<{
  include: { trackerDevice: true; customer: true };
}>;

function buildVehicleScope(
  allowedCustomerIds: string[] | null,
  allowedVehicleIds: string[] | null,
): any {
  const clauses: any[] = [];
  if (allowedCustomerIds !== null) clauses.push({ customerId: { in: allowedCustomerIds } });
  if (allowedVehicleIds !== null && allowedVehicleIds.length > 0)
    clauses.push({ id: { in: allowedVehicleIds } });
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { OR: clauses };
}

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
        vehicleSpecies: dto.vehicleSpecies,
        vehicleBodyType: dto.vehicleBodyType,
        vehicleTraction: dto.vehicleTraction,
        vehicleUseCategory: dto.vehicleUseCategory,
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
    allowedVehicleIds: string[] | null = null,
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

    const { trackerDeviceId, ...restDto } = dto;
    const data = Object.fromEntries(
      (Object.entries(restDto) as [keyof Omit<UpdateVehicleDto, "trackerDeviceId">, unknown][]).filter(
        ([, value]) => value !== undefined,
      ),
    ) as Prisma.VehicleUncheckedUpdateInput;

    let vehicle: { id: string } | null = null;

    if (trackerDeviceId === null) {
      vehicle = await this.prisma.vehicle.update({
        where: { id },
        data: { ...data, trackerDeviceId: null },
      });
    } else if (trackerDeviceId !== undefined) {
      const tracker = await this.prisma.trackerDevice.findFirst({
        where: { id: trackerDeviceId, organizationId },
        select: { id: true },
      });
      if (!tracker) {
        throw new BadRequestException(ApiCode.ORGANIZATION_NOT_FOUND);
      }

      vehicle = await this.prisma.$transaction(async (tx) => {
        await tx.vehicle.updateMany({
          where: { organizationId, trackerDeviceId, id: { not: id } },
          data: { trackerDeviceId: null },
        });
        return tx.vehicle.update({
          where: { id },
          data: { ...data, trackerDeviceId },
        });
      });
    } else {
      vehicle = await this.prisma.vehicle.update({
        where: { id },
        data,
      });
    }
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
    allowedVehicleIds: string[] | null = null,
  ): Promise<VehicleResponseDto> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
      include: { trackerDevice: true, customer: true },
    });
    if (!vehicle) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);

    // Check OR scope
    const hasCustomerAccess = allowedCustomerIds === null || allowedCustomerIds.includes(vehicle.customerId);
    const hasVehicleAccess = allowedVehicleIds === null || (allowedVehicleIds.length > 0 && allowedVehicleIds.includes(vehicleId));
    const hasAccessViaDimension = hasCustomerAccess || hasVehicleAccess;

    if (!hasAccessViaDimension) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
    return this.toResponse(vehicle as VehicleWithDeviceAndCustomer);
  }

  async listByOrganization(
    organizationId: string,
    allowedCustomerIds: string[] | null,
    allowedVehicleIds: string[] | null = null,
    filterCustomerIds?: string[] | null,
    activeOnly?: boolean,
    inactiveOnly?: boolean,
  ): Promise<VehicleResponseDto[]> {
    const where: Prisma.VehicleWhereInput = {
      organizationId,
      ...(activeOnly ? { inactive: false } : {}),
      ...(inactiveOnly ? { inactive: true } : {}),
    };

    // When filterCustomerIds is specified, use it; otherwise use the scope-based logic
    if (filterCustomerIds !== undefined && filterCustomerIds !== null) {
      if (filterCustomerIds.length === 0) return [];
      where.customerId = { in: filterCustomerIds };
    } else {
      // Apply OR logic for customer and vehicle IDs
      const scope = buildVehicleScope(allowedCustomerIds, allowedVehicleIds);
      if (Object.keys(scope).length === 0) {
        // Full access case
      } else if (scope.OR) {
        where.OR = scope.OR;
      } else if (scope.customerId) {
        where.customerId = scope.customerId;
      } else if (scope.id) {
        where.id = scope.id;
      }

      // Special case: if both empty arrays and no customer access, return empty
      if (allowedVehicleIds !== null && allowedVehicleIds.length === 0 && allowedCustomerIds === null) {
        return [];
      }
    }

    const list = await this.prisma.vehicle.findMany({
      where,
      include: { trackerDevice: true, customer: true },
    });
    return list.map((v) => this.toResponse(v as VehicleWithDeviceAndCustomer));
  }

  async listFleetStatus(
    organizationId: string,
    allowedCustomerIds: string[] | null,
    allowedVehicleIds: string[] | null = null,
    filterCustomerIds?: string[] | null,
  ): Promise<FleetVehicleStatusDto[]> {
    const where: Prisma.VehicleWhereInput = { organizationId };

    // When filterCustomerIds is specified, use it; otherwise use the scope-based logic
    if (filterCustomerIds !== undefined && filterCustomerIds !== null) {
      if (filterCustomerIds.length === 0) return [];
      where.customerId = { in: filterCustomerIds };
    } else {
      // Apply OR logic for customer and vehicle IDs
      const scope = buildVehicleScope(allowedCustomerIds, allowedVehicleIds);
      if (Object.keys(scope).length === 0) {
        // Full access case
      } else if (scope.OR) {
        where.OR = scope.OR;
      } else if (scope.customerId) {
        where.customerId = scope.customerId;
      } else if (scope.id) {
        where.id = scope.id;
      }

      // Special case: if both empty arrays and no customer access, return empty
      if (allowedVehicleIds !== null && allowedVehicleIds.length === 0 && allowedCustomerIds === null) {
        return [];
      }
    }
    const list = await this.prisma.vehicle.findMany({
      where,
      include: { trackerDevice: true, customer: true },
    });

    const results = await Promise.all(
      list.map(async (v) => {
        const lastPosition = v.trackerDevice
          ? await this.devicesService.getLastPosition(v.trackerDevice.id)
          : null;
        return {
          id: v.id,
          name: v.name ?? null,
          plate: v.plate ?? null,
          color: v.color ?? null,
          vehicleType: v.vehicleType ?? null,
          inactive: v.inactive,
          initialOdometerKm: v.initialOdometerKm ?? null,
          customer: v.customer ? { id: v.customer.id, name: v.customer.name } : null,
          trackerDevice: v.trackerDevice
            ? {
                id: v.trackerDevice.id,
                imei: v.trackerDevice.imei,
                connectedAt: v.trackerDevice.connectedAt?.toISOString() ?? null,
              }
            : null,
          lastPosition: lastPosition ?? null,
        } satisfies FleetVehicleStatusDto;
      }),
    );

    return results;
  }

  async delete(
    id: string,
    allowedCustomerIds: string[] | null,
    allowedVehicleIds: string[] | null = null,
  ): Promise<void> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      select: { customerId: true },
    });
    if (!vehicle) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);

    // Check OR scope
    const hasCustomerAccess = allowedCustomerIds === null || allowedCustomerIds.includes(vehicle.customerId);
    const hasVehicleAccess = allowedVehicleIds === null || (allowedVehicleIds.length > 0 && allowedVehicleIds.includes(id));
    const hasAccessViaDimension = hasCustomerAccess || hasVehicleAccess;

    if (!hasAccessViaDimension) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
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
      vehicleSpecies: v.vehicleSpecies ?? undefined,
      vehicleBodyType: v.vehicleBodyType ?? undefined,
      vehicleTraction: v.vehicleTraction ?? undefined,
      vehicleUseCategory: v.vehicleUseCategory ?? undefined,
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

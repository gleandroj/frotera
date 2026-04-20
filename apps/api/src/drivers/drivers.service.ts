import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomersService } from '@/customers/customers.service';
import type { OrganizationMember } from '@prisma/client';
import {
  AssignVehicleDto,
  CreateDriverDto,
  DriverResponseDto,
  DriverVehicleAssignmentResponseDto,
  UpdateDriverDto,
} from './drivers.dto';
import { ApiCode } from '@/common/api-codes.enum';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  // ── LIST ──────────────────────────────────────────────────────────────────

  async list(
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
    filterCustomerId?: string,
    activeOnly?: boolean,
    inactiveOnly?: boolean,
    allowedDriverIds: string[] | null = null,
  ): Promise<DriverResponseDto[]> {
    const allowedCustomerIds = await this.customersService.getAllowedCustomerIds(
      member,
      organizationId,
    );

    // Se ambos os escopos de acesso são vazios, retorna vazio
    if (
      (allowedCustomerIds !== null && allowedCustomerIds.length === 0) &&
      (allowedDriverIds !== null && allowedDriverIds.length === 0)
    ) {
      return [];
    }

    const where: any = {
      organizationId,
      ...(activeOnly ? { active: true } : {}),
      ...(inactiveOnly ? { active: false } : {}),
    };

    if (filterCustomerId) {
      // Mesma regra dos veículos e do checklist: empresa raiz + filiais (descendentes),
      // cruzado com o escopo do membro.
      const descendantIds = await this.customersService.getDescendantCustomerIds(
        [filterCustomerId],
        organizationId,
      );
      const filterSet = [filterCustomerId, ...descendantIds];
      const effectiveIds =
        allowedCustomerIds === null
          ? filterSet
          : filterSet.filter((id) => allowedCustomerIds.includes(id));
      if (effectiveIds.length === 0) {
        return [];
      }
      where.customerId = { in: effectiveIds };
    } else {
      // Apply OR logic for customer and driver IDs
      const scopeClauses: any[] = [];
      if (allowedCustomerIds !== null) {
        scopeClauses.push({ customerId: { in: allowedCustomerIds } });
      }
      if (allowedDriverIds !== null && allowedDriverIds.length > 0) {
        scopeClauses.push({ id: { in: allowedDriverIds } });
      }
      if (scopeClauses.length > 1) {
        where.OR = scopeClauses;
      } else if (scopeClauses.length === 1) {
        Object.assign(where, scopeClauses[0]);
      }
    }

    const rows = await this.prisma.driver.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      include: {
        customer: { select: { id: true, name: true } },
        vehicleAssignments: {
          where: { endDate: null }, // apenas vínculos ativos
          include: { vehicle: { select: { id: true, name: true, plate: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    return rows.map(this.toResponse.bind(this));
  }

  // ── CREATE ────────────────────────────────────────────────────────────────

  async create(
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
    dto: CreateDriverDto,
  ): Promise<DriverResponseDto> {
    // Validar CPF único por organização
    if (dto.cpf) {
      const cpfNormalized = dto.cpf.trim();
      const existing = await this.prisma.driver.findFirst({
        where: { organizationId, cpf: cpfNormalized },
      });
      if (existing) {
        throw new ConflictException(ApiCode.COMMON_ALREADY_EXISTS);
      }
    }

    const customerId = dto.customerId?.trim();
    if (!customerId) {
      throw new BadRequestException(ApiCode.COMMON_BAD_REQUEST);
    }
    await this.validateCustomerAccess(customerId, organizationId, member);

    const driver = await this.prisma.driver.create({
      data: {
        organizationId,
        customerId,
        name: dto.name.trim(),
        cpf: dto.cpf?.trim() || null,
        cnh: dto.cnh?.trim() || null,
        cnhCategory: dto.cnhCategory?.trim() || null,
        cnhExpiry: dto.cnhExpiry ? new Date(dto.cnhExpiry) : null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        photo: dto.photo?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
      include: {
        customer: { select: { id: true, name: true } },
        vehicleAssignments: {
          where: { endDate: null },
          include: { vehicle: { select: { id: true, name: true, plate: true } } },
        },
      },
    });

    return this.toResponse(driver);
  }

  // ── GET BY ID ─────────────────────────────────────────────────────────────

  async getById(
    driverId: string,
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
  ): Promise<DriverResponseDto> {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, organizationId },
      include: {
        customer: { select: { id: true, name: true } },
        vehicleAssignments: {
          include: { vehicle: { select: { id: true, name: true, plate: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);
    }

    await this.validateCustomerReadAccess(driver.customerId, organizationId, member);

    return this.toResponse(driver);
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  async update(
    driverId: string,
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
    dto: UpdateDriverDto,
  ): Promise<DriverResponseDto> {
    const existing = await this.prisma.driver.findFirst({
      where: { id: driverId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);
    }

    await this.validateCustomerReadAccess(existing.customerId, organizationId, member);

    if (dto.customerId !== undefined) {
      const next = dto.customerId?.trim();
      if (!next) {
        throw new BadRequestException(ApiCode.COMMON_BAD_REQUEST);
      }
      await this.validateCustomerAccess(next, organizationId, member);
    }

    // Validar CPF único se alterado
    if (dto.cpf !== undefined && dto.cpf !== null && dto.cpf !== existing.cpf) {
      const cpfNormalized = dto.cpf.trim();
      const conflict = await this.prisma.driver.findFirst({
        where: { organizationId, cpf: cpfNormalized, NOT: { id: driverId } },
      });
      if (conflict) {
        throw new ConflictException(ApiCode.COMMON_ALREADY_EXISTS);
      }
    }

    const driver = await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.customerId !== undefined && {
          customerId: dto.customerId.trim(),
        }),
        ...(dto.cpf !== undefined && { cpf: dto.cpf?.trim() || null }),
        ...(dto.cnh !== undefined && { cnh: dto.cnh?.trim() || null }),
        ...(dto.cnhCategory !== undefined && { cnhCategory: dto.cnhCategory }),
        ...(dto.cnhExpiry !== undefined && {
          cnhExpiry: dto.cnhExpiry ? new Date(dto.cnhExpiry) : null,
        }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
        ...(dto.photo !== undefined && { photo: dto.photo?.trim() || null }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
      },
      include: {
        customer: { select: { id: true, name: true } },
        vehicleAssignments: {
          include: { vehicle: { select: { id: true, name: true, plate: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    return this.toResponse(driver);
  }

  // ── DELETE (soft) ─────────────────────────────────────────────────────────

  async delete(
    driverId: string,
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
  ): Promise<void> {
    const existing = await this.prisma.driver.findFirst({
      where: { id: driverId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);
    }

    await this.validateCustomerReadAccess(existing.customerId, organizationId, member);

    // Soft delete: marcar como inativo e encerrar vínculos ativos
    await this.prisma.$transaction([
      this.prisma.driverVehicleAssignment.updateMany({
        where: { driverId, endDate: null },
        data: { endDate: new Date() },
      }),
      this.prisma.driver.update({
        where: { id: driverId },
        data: { active: false },
      }),
    ]);
  }

  // ── ASSIGN VEHICLE ────────────────────────────────────────────────────────

  async assignVehicle(
    driverId: string,
    organizationId: string,
    dto: AssignVehicleDto,
  ): Promise<DriverVehicleAssignmentResponseDto> {
    const { startDate, endDate } = this.parseAssignmentPeriod(dto);

    // Verificar que motorista e veículo pertencem à mesma organização
    const [driver, vehicle] = await Promise.all([
      this.prisma.driver.findFirst({ where: { id: driverId, organizationId, active: true } }),
      this.prisma.vehicle.findFirst({ where: { id: dto.vehicleId, organizationId } }),
    ]);

    if (!driver) throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);
    if (!vehicle) throw new NotFoundException(ApiCode.VEHICLE_NOT_FOUND);

    const overlapWhere = this.buildOverlapWhere({
      driverId,
      startDate,
      endDate,
      vehicleId: dto.vehicleId,
    });

    const overlappingAssignment = await this.prisma.driverVehicleAssignment.findFirst({
      where: overlapWhere,
    });
    if (overlappingAssignment) {
      throw new ConflictException(ApiCode.DRIVER_ASSIGNMENT_OVERLAP);
    }

    if (dto.isPrimary) {
      const overlappingPrimary = await this.prisma.driverVehicleAssignment.findFirst({
        where: this.buildOverlapWhere({
          driverId,
          startDate,
          endDate,
          isPrimary: true,
        }),
      });
      if (overlappingPrimary) {
        throw new ConflictException(ApiCode.DRIVER_PRIMARY_ASSIGNMENT_OVERLAP);
      }
    }

    const assignment = await this.prisma.driverVehicleAssignment.create({
      data: {
        driverId,
        vehicleId: dto.vehicleId,
        isPrimary: dto.isPrimary ?? false,
        startDate,
        endDate,
      },
      include: { vehicle: { select: { id: true, name: true, plate: true } } },
    });

    return this.toAssignmentResponse(assignment);
  }

  // ── UNASSIGN VEHICLE ──────────────────────────────────────────────────────

  async unassignVehicle(
    driverId: string,
    vehicleId: string,
    organizationId: string,
  ): Promise<void> {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, organizationId },
    });
    if (!driver) throw new NotFoundException(ApiCode.DRIVER_NOT_FOUND);

    const assignment = await this.prisma.driverVehicleAssignment.findFirst({
      where: { driverId, vehicleId, endDate: null },
    });
    if (!assignment) throw new NotFoundException(ApiCode.DRIVER_ASSIGNMENT_NOT_FOUND);

    await this.prisma.driverVehicleAssignment.update({
      where: { id: assignment.id },
      data: { endDate: new Date() },
    });
  }

  // ── HELPERS PRIVADOS ──────────────────────────────────────────────────────

  private async validateCustomerAccess(
    customerId: string,
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
  ): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer) throw new NotFoundException(ApiCode.ORGANIZATION_NOT_FOUND);

    const allowedIds = await this.customersService.getAllowedCustomerIds(member, organizationId);
    if (allowedIds !== null && !allowedIds.includes(customerId)) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
  }

  private async validateCustomerReadAccess(
    customerId: string,
    organizationId: string,
    member: Pick<OrganizationMember, 'id' | 'customerRestricted'>,
  ): Promise<void> {
    const allowedIds = await this.customersService.getAllowedCustomerIds(member, organizationId);
    if (allowedIds !== null && !allowedIds.includes(customerId)) {
      throw new ForbiddenException(ApiCode.AUTH_FORBIDDEN);
    }
  }

  private toResponse(driver: any): DriverResponseDto {
    return {
      id: driver.id,
      organizationId: driver.organizationId,
      customerId: driver.customerId,
      name: driver.name,
      cpf: driver.cpf,
      cnh: driver.cnh,
      cnhCategory: driver.cnhCategory,
      cnhExpiry: driver.cnhExpiry?.toISOString() ?? null,
      phone: driver.phone,
      email: driver.email,
      photo: driver.photo,
      active: driver.active,
      notes: driver.notes,
      createdAt: driver.createdAt.toISOString(),
      updatedAt: driver.updatedAt.toISOString(),
      customer: driver.customer ?? null,
      vehicleAssignments: driver.vehicleAssignments?.map(
        this.toAssignmentResponse.bind(this),
      ),
    };
  }

  private toAssignmentResponse(assignment: any): DriverVehicleAssignmentResponseDto {
    return {
      id: assignment.id,
      driverId: assignment.driverId,
      vehicleId: assignment.vehicleId,
      startDate: assignment.startDate.toISOString(),
      endDate: assignment.endDate?.toISOString() ?? null,
      isPrimary: assignment.isPrimary,
      vehicle: assignment.vehicle ?? undefined,
    };
  }

  private parseAssignmentPeriod(dto: AssignVehicleDto): { startDate: Date; endDate: Date | null } {
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
      throw new BadRequestException(ApiCode.DRIVER_ASSIGNMENT_INVALID_PERIOD);
    }

    if (endDate && endDate <= startDate) {
      throw new BadRequestException(ApiCode.DRIVER_ASSIGNMENT_INVALID_PERIOD);
    }

    return { startDate, endDate };
  }

  private buildOverlapWhere(params: {
    driverId: string;
    startDate: Date;
    endDate: Date | null;
    vehicleId?: string;
    isPrimary?: boolean;
  }) {
    const intervalEnd = params.endDate ?? new Date('9999-12-31T23:59:59.999Z');

    return {
      driverId: params.driverId,
      ...(params.vehicleId ? { vehicleId: params.vehicleId } : {}),
      ...(params.isPrimary !== undefined ? { isPrimary: params.isPrimary } : {}),
      AND: [
        { startDate: { lte: intervalEnd } },
        {
          OR: [
            { endDate: null },
            { endDate: { gte: params.startDate } },
          ],
        },
      ],
    };
  }
}

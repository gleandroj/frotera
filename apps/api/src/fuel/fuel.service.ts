import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomersService } from '@/customers/customers.service';
import { FuelPriceApiService } from './fuel-price-api.service';
import { ApiCode } from '@/common/api-codes.enum';
import {
  CreateFuelLogDto,
  UpdateFuelLogDto,
  FuelLogResponseDto,
  FuelStatsResponseDto,
  ListFuelLogsQueryDto,
  FuelStatsQueryDto,
} from './fuel.dto';

@Injectable()
export class FuelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly fuelPriceApiService: FuelPriceApiService,
  ) {}

  /**
   * List fuel logs for the organization with optional filters
   */
  async list(
    organizationId: string,
    userId: string,
    query: ListFuelLogsQueryDto,
  ): Promise<FuelLogResponseDto[]> {
    // Get member and allowed customer IDs
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const allowedCustomerIds = await this.customersService.getAllowedCustomerIds(
      member,
      organizationId,
    );

    // Build vehicle filter based on customer scope
    const allowedVehicleFilter = allowedCustomerIds !== null
      ? { customerId: { in: allowedCustomerIds } }
      : {};
    const allowedVehicles = await this.prisma.vehicle.findMany({
      where: { organizationId, ...allowedVehicleFilter },
      select: { id: true },
    });
    const allowedVehicleIds = allowedVehicles.map((v) => v.id);

    // Build filter conditions
    const where: any = {
      organizationId,
      vehicleId: { in: allowedVehicleIds },
    };

    if (query.vehicleId && allowedVehicleIds.includes(query.vehicleId)) {
      where.vehicleId = query.vehicleId;
    }

    if (query.driverId) {
      where.driverId = query.driverId;
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) {
        where.date.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.date.lte = new Date(query.dateTo);
      }
    }

    if (query.fuelType) {
      where.fuelType = query.fuelType;
    }

    const logs = await this.prisma.fuelLog.findMany({
      where,
      include: {
        vehicle: {
          select: { id: true, name: true, plate: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    return this.mapToResponse(logs);
  }

  /**
   * Create a new fuel log
   */
  async create(
    organizationId: string,
    userId: string,
    dto: CreateFuelLogDto,
  ): Promise<FuelLogResponseDto> {
    // Verify member exists
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }

    // Verify vehicle exists and belongs to the organization
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, organizationId },
      include: { customer: { select: { id: true } } },
    });
    if (!vehicle) {
      throw new NotFoundException(ApiCode.VEHICLE_NOT_FOUND);
    }

    // Check customer scope access
    const allowedCustomerIds = await this.customersService.getAllowedCustomerIds(
      member,
      organizationId,
    );
    if (
      allowedCustomerIds !== null &&
      vehicle.customerId &&
      !allowedCustomerIds.includes(vehicle.customerId)
    ) {
      throw new ForbiddenException('No access to this vehicle');
    }

    // Calculate totalCost
    const totalCost = parseFloat((dto.liters * dto.pricePerLiter).toFixed(2));

    // Calculate consumption from previous record
    const previousLog = await this.prisma.fuelLog.findFirst({
      where: {
        vehicleId: dto.vehicleId,
        organizationId,
        date: { lt: new Date(dto.date) },
      },
      orderBy: [{ date: 'desc' }, { odometer: 'desc' }],
    });

    const kmDriven = previousLog ? dto.odometer - previousLog.odometer : null;
    const consumption =
      kmDriven && kmDriven > 0 && dto.liters > 0
        ? parseFloat((kmDriven / dto.liters).toFixed(2))
        : null;

    // Get organization to find state
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { id: true }, // TODO: add 'state' field when available
    });

    // Get market price reference
    let marketPriceRef: number | null = null;
    if (organization) {
      // For now, use 'SP' as default state. This should be configurable in Organization model.
      const orgState = 'SP'; // TODO: use organization.state when available
      const snapshot = await this.fuelPriceApiService.getLatestPrice(
        orgState,
        dto.fuelType,
      );
      marketPriceRef = snapshot?.avgPrice ?? null;
    }

    const log = await this.prisma.fuelLog.create({
      data: {
        organizationId,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId || null,
        createdById: member.id,
        date: new Date(dto.date),
        odometer: dto.odometer,
        liters: dto.liters,
        pricePerLiter: dto.pricePerLiter,
        totalCost,
        fuelType: dto.fuelType,
        station: dto.station,
        city: dto.city,
        receipt: dto.receipt,
        notes: dto.notes,
        consumption,
        marketPriceRef,
      },
      include: {
        vehicle: {
          select: { id: true, name: true, plate: true },
        },
      },
    });

    return this.mapSingleToResponse(log);
  }

  /**
   * Get a single fuel log by ID
   */
  async getById(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<FuelLogResponseDto> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const allowedCustomerIds = await this.customersService.getAllowedCustomerIds(
      member,
      organizationId,
    );

    const log = await this.prisma.fuelLog.findFirst({
      where: { id, organizationId },
      include: {
        vehicle: {
          select: { id: true, name: true, plate: true, customerId: true },
        },
      },
    });

    if (!log) {
      throw new NotFoundException(ApiCode.FUEL_LOG_NOT_FOUND);
    }

    // Check customer scope access
    if (
      allowedCustomerIds !== null &&
      log.vehicle.customerId &&
      !allowedCustomerIds.includes(log.vehicle.customerId)
    ) {
      throw new ForbiddenException('No access to this fuel log');
    }

    return this.mapSingleToResponse(log);
  }

  /**
   * Update a fuel log
   */
  async update(
    id: string,
    organizationId: string,
    userId: string,
    dto: UpdateFuelLogDto,
  ): Promise<FuelLogResponseDto> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }

    // Get current log
    const currentLog = await this.prisma.fuelLog.findFirst({
      where: { id, organizationId },
      include: {
        vehicle: {
          select: { id: true, name: true, plate: true, customerId: true },
        },
      },
    });

    if (!currentLog) {
      throw new NotFoundException(ApiCode.FUEL_LOG_NOT_FOUND);
    }

    // Check customer scope access
    const allowedCustomerIds = await this.customersService.getAllowedCustomerIds(
      member,
      organizationId,
    );
    if (
      allowedCustomerIds !== null &&
      currentLog.vehicle.customerId &&
      !allowedCustomerIds.includes(currentLog.vehicle.customerId)
    ) {
      throw new ForbiddenException('No access to this fuel log');
    }

    // Use current values as defaults
    const date = dto.date ? new Date(dto.date) : currentLog.date;
    const odometer = dto.odometer ?? currentLog.odometer;
    const liters = dto.liters ?? currentLog.liters;
    const pricePerLiter = dto.pricePerLiter ?? currentLog.pricePerLiter;

    // Recalculate totalCost
    const totalCost = parseFloat((liters * pricePerLiter).toFixed(2));

    // Recalculate consumption
    const previousLog = await this.prisma.fuelLog.findFirst({
      where: {
        vehicleId: currentLog.vehicleId,
        organizationId,
        date: { lt: date },
        id: { not: id },
      },
      orderBy: [{ date: 'desc' }, { odometer: 'desc' }],
    });

    const kmDriven = previousLog ? odometer - previousLog.odometer : null;
    const consumption =
      kmDriven && kmDriven > 0 && liters > 0
        ? parseFloat((kmDriven / liters).toFixed(2))
        : null;

    const updated = await this.prisma.fuelLog.update({
      where: { id },
      data: {
        driverId: dto.driverId ?? currentLog.driverId,
        date,
        odometer,
        liters,
        pricePerLiter,
        totalCost,
        fuelType: dto.fuelType ?? currentLog.fuelType,
        station: dto.station ?? currentLog.station,
        city: dto.city ?? currentLog.city,
        receipt: dto.receipt ?? currentLog.receipt,
        notes: dto.notes ?? currentLog.notes,
        consumption,
      },
      include: {
        vehicle: {
          select: { id: true, name: true, plate: true },
        },
      },
    });

    return this.mapSingleToResponse(updated);
  }

  /**
   * Delete a fuel log
   */
  async delete(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const log = await this.prisma.fuelLog.findFirst({
      where: { id, organizationId },
      include: {
        vehicle: {
          select: { customerId: true },
        },
      },
    });

    if (!log) {
      throw new NotFoundException(ApiCode.FUEL_LOG_NOT_FOUND);
    }

    // Check customer scope access
    const allowedCustomerIds = await this.customersService.getAllowedCustomerIds(
      member,
      organizationId,
    );
    if (
      allowedCustomerIds !== null &&
      log.vehicle.customerId &&
      !allowedCustomerIds.includes(log.vehicle.customerId)
    ) {
      throw new ForbiddenException('No access to this fuel log');
    }

    await this.prisma.fuelLog.delete({ where: { id } });
  }

  /**
   * Get statistics for fuel logs
   */
  async getStats(
    organizationId: string,
    userId: string,
    query: FuelStatsQueryDto,
  ): Promise<FuelStatsResponseDto> {
    // Get member and allowed customer IDs
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const allowedCustomerIds = await this.customersService.getAllowedCustomerIds(
      member,
      organizationId,
    );

    // Build vehicle filter
    const allowedVehicleFilter = allowedCustomerIds !== null
      ? { customerId: { in: allowedCustomerIds } }
      : {};
    const allowedVehicles = await this.prisma.vehicle.findMany({
      where: { organizationId, ...allowedVehicleFilter },
      select: { id: true },
    });
    const allowedVehicleIds = allowedVehicles.map((v) => v.id);

    // Build where clause
    const where: any = {
      organizationId,
      vehicleId: { in: allowedVehicleIds },
    };

    if (query.vehicleId && allowedVehicleIds.includes(query.vehicleId)) {
      where.vehicleId = query.vehicleId;
    }

    if (query.driverId) {
      where.driverId = query.driverId;
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) {
        where.date.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.date.lte = new Date(query.dateTo);
      }
    }

    // Get all logs matching the filter
    const allLogs = await this.prisma.fuelLog.findMany({
      where,
      select: {
        id: true,
        totalCost: true,
        liters: true,
        odometer: true,
        date: true,
        consumption: true,
      },
      orderBy: { date: 'asc' },
    });

    // Calculate stats
    const totalCost = allLogs.reduce((sum, log) => sum + log.totalCost, 0);
    const totalLiters = allLogs.reduce((sum, log) => sum + log.liters, 0);
    const count = allLogs.length;

    // Calculate average consumption (weighted by km)
    let avgConsumption: number | null = null;
    if (allLogs.length > 1) {
      const firstOdometer = allLogs[0].odometer;
      const lastOdometer = allLogs[allLogs.length - 1].odometer;
      const totalKm = lastOdometer - firstOdometer;
      if (totalKm > 0 && totalLiters > 0) {
        avgConsumption = parseFloat((totalKm / totalLiters).toFixed(2));
      }
    }

    // Calculate average cost per km
    let avgCostPerKm: number | null = null;
    if (allLogs.length > 1) {
      const firstOdometer = allLogs[0].odometer;
      const lastOdometer = allLogs[allLogs.length - 1].odometer;
      const totalKm = lastOdometer - firstOdometer;
      if (totalKm > 0) {
        avgCostPerKm = parseFloat((totalCost / totalKm).toFixed(4));
      }
    }

    // Get current month stats
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthLogs = await this.prisma.fuelLog.findMany({
      where: {
        ...where,
        date: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      select: {
        totalCost: true,
      },
    });

    const currentMonthCost = monthLogs.reduce((sum, log) => sum + log.totalCost, 0);
    const currentMonthCount = monthLogs.length;

    return {
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalLiters: parseFloat(totalLiters.toFixed(2)),
      count,
      avgConsumption,
      avgCostPerKm,
      currentMonthCost: parseFloat(currentMonthCost.toFixed(2)),
      currentMonthCount,
    };
  }

  /**
   * Get market price for a given state and fuel type
   */
  async getMarketPrices(
    state: string,
    fuelType: string,
  ): Promise<{ avgPrice: number | null; refDate: string | null }> {
    if (!state || !fuelType) {
      return { avgPrice: null, refDate: null };
    }

    try {
      const snapshot = await this.fuelPriceApiService.getLatestPrice(
        state,
        fuelType as any,
      );

      if (!snapshot) {
        return { avgPrice: null, refDate: null };
      }

      return {
        avgPrice: snapshot.avgPrice,
        refDate: snapshot.refDate.toISOString().split('T')[0],
      };
    } catch (error) {
      // Return null values if there's an error
      return { avgPrice: null, refDate: null };
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────────────────

  private mapToResponse(logs: any[]): FuelLogResponseDto[] {
    return logs.map((log) => this.mapSingleToResponse(log));
  }

  private mapSingleToResponse(log: any): FuelLogResponseDto {
    return {
      id: log.id,
      organizationId: log.organizationId,
      vehicleId: log.vehicleId,
      driverId: log.driverId ?? undefined,
      createdById: log.createdById,
      date: log.date.toISOString(),
      odometer: log.odometer,
      liters: log.liters,
      pricePerLiter: log.pricePerLiter,
      totalCost: log.totalCost,
      fuelType: log.fuelType,
      station: log.station ?? undefined,
      city: log.city ?? undefined,
      receipt: log.receipt ?? undefined,
      notes: log.notes ?? undefined,
      consumption: log.consumption ?? null,
      marketPriceRef: log.marketPriceRef ?? null,
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString(),
      vehicle: log.vehicle,
    };
  }
}

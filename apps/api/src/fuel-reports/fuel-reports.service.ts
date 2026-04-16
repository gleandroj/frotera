import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomersService } from '@/customers/customers.service';
import { FuelPriceApiService } from '@/fuel/fuel-price-api.service';
import { FuelType } from '@prisma/client';
import {
  ConsumptionReportQueryDto,
  CostsReportQueryDto,
  BenchmarkReportQueryDto,
  EfficiencyReportQueryDto,
  SummaryReportQueryDto,
  VehicleConsumptionDto,
  CostsPeriodDto,
  BenchmarkSummaryDto,
  BenchmarkPointDto,
  VehicleEfficiencyDto,
  PeriodSummaryDto,
} from './fuel-reports.dto';

@Injectable()
export class FuelReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly fuelPriceApiService: FuelPriceApiService,
  ) {}

  /**
   * Get consumption report by vehicle
   */
  async getConsumptionReport(
    organizationId: string,
    memberId: string,
    query: ConsumptionReportQueryDto,
  ): Promise<VehicleConsumptionDto[]> {
    const allowedVehicleIds = await this.getAllowedVehicleIds(
      organizationId,
      memberId,
    );

    // Build where clause
    const where: any = {
      organizationId,
      vehicleId: { in: allowedVehicleIds },
    };

    if (query.vehicleId && allowedVehicleIds.includes(query.vehicleId)) {
      where.vehicleId = query.vehicleId;
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

    const logs = await this.prisma.fuelLog.findMany({
      where,
      include: {
        vehicle: {
          select: { id: true, name: true, plate: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group by vehicle
    const byVehicle: Record<string, any[]> = {};
    logs.forEach((log) => {
      if (!byVehicle[log.vehicleId]) {
        byVehicle[log.vehicleId] = [];
      }
      byVehicle[log.vehicleId].push(log);
    });

    const result: VehicleConsumptionDto[] = [];

    for (const [vehicleId, vehicleLogs] of Object.entries(byVehicle)) {
      const firstLog = vehicleLogs[0];
      let avgConsumption: number | null = null;
      let bestConsumption: number | null = null;
      let worstConsumption: number | null = null;
      let totalKm: number | null = null;
      let trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data' =
        'insufficient_data';
      const timeSeries: Array<{ date: string; consumption: number | null }> =
        [];

      const consumptions = vehicleLogs
        .filter((l) => l.consumption !== null)
        .map((l) => l.consumption);

      if (consumptions.length > 0) {
        avgConsumption = parseFloat(
          (consumptions.reduce((a, b) => a + b, 0) / consumptions.length).toFixed(
            2,
          ),
        );
        bestConsumption = parseFloat(
          Math.max(...consumptions).toFixed(2),
        );
        worstConsumption = parseFloat(
          Math.min(...consumptions).toFixed(2),
        );
      }

      if (vehicleLogs.length > 1) {
        const firstOdometer = vehicleLogs[0].odometer;
        const lastOdometer = vehicleLogs[vehicleLogs.length - 1].odometer;
        totalKm = parseFloat((lastOdometer - firstOdometer).toFixed(2));
      }

      // Build time series
      vehicleLogs.forEach((log) => {
        timeSeries.push({
          date: log.date.toISOString().split('T')[0],
          consumption: log.consumption,
        });
      });

      // Calculate trend
      if (consumptions.length >= 3) {
        const mid = Math.ceil(consumptions.length / 2);
        const firstHalf = consumptions.slice(0, mid);
        const secondHalf = consumptions.slice(mid);
        const avgFirst =
          firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond =
          secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        const dropPct = ((avgFirst - avgSecond) / avgFirst) * 100;

        if (dropPct > 5) {
          trend = 'worsening';
        } else if (dropPct < -5) {
          trend = 'improving';
        } else {
          trend = 'stable';
        }
      }

      result.push({
        vehicleId,
        vehicleName: firstLog.vehicle.name,
        vehiclePlate: firstLog.vehicle.plate,
        avgConsumption,
        bestConsumption,
        worstConsumption,
        totalKm,
        totalLiters: parseFloat(
          vehicleLogs
            .reduce((sum, log) => sum + log.liters, 0)
            .toFixed(2),
        ),
        logsCount: vehicleLogs.length,
        trend,
        timeSeries,
      });
    }

    return result;
  }

  /**
   * Get costs report grouped by period
   */
  async getCostsReport(
    organizationId: string,
    memberId: string,
    query: CostsReportQueryDto,
  ): Promise<CostsPeriodDto[]> {
    const allowedVehicleIds = await this.getAllowedVehicleIds(
      organizationId,
      memberId,
    );
    const groupBy = query.groupBy ?? 'month';

    const where: any = {
      organizationId,
      vehicleId: { in: allowedVehicleIds },
    };

    if (query.vehicleId && allowedVehicleIds.includes(query.vehicleId)) {
      where.vehicleId = query.vehicleId;
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

    const logs = await this.prisma.fuelLog.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    const byPeriod: Record<string, any[]> = {};

    logs.forEach((log) => {
      const date = log.date;
      let period: string;

      if (groupBy === 'day') {
        period = date.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        period = date.toISOString().slice(0, 7);
      } else {
        period = date.getFullYear().toString();
      }

      if (!byPeriod[period]) {
        byPeriod[period] = [];
      }
      byPeriod[period].push(log);
    });

    const result: CostsPeriodDto[] = [];

    for (const [period, periodLogs] of Object.entries(byPeriod)) {
      const totalCost = periodLogs.reduce((sum, log) => sum + log.totalCost, 0);
      const totalLiters = periodLogs.reduce((sum, log) => sum + log.liters, 0);
      let avgPricePerLiter: number | null = null;
      let costPerKm: number | null = null;

      if (totalLiters > 0) {
        avgPricePerLiter = parseFloat((totalCost / totalLiters).toFixed(2));
      }

      // Calculate cost per km
      if (periodLogs.length > 1) {
        const firstOdometer = periodLogs[0].odometer;
        const lastOdometer = periodLogs[periodLogs.length - 1].odometer;
        const totalKm = lastOdometer - firstOdometer;
        if (totalKm > 0) {
          costPerKm = parseFloat((totalCost / totalKm).toFixed(4));
        }
      }

      // Group by fuel type
      const byFuelType: Record<string, { cost: number; liters: number }> = {};
      periodLogs.forEach((log) => {
        const fuelType = log.fuelType;
        if (!byFuelType[fuelType]) {
          byFuelType[fuelType] = { cost: 0, liters: 0 };
        }
        byFuelType[fuelType].cost += log.totalCost;
        byFuelType[fuelType].liters += log.liters;
      });

      result.push({
        period,
        totalCost: parseFloat(totalCost.toFixed(2)),
        totalLiters: parseFloat(totalLiters.toFixed(2)),
        logsCount: periodLogs.length,
        avgPricePerLiter,
        costPerKm,
        byFuelType,
      });
    }

    return result;
  }

  /**
   * Get benchmark report (price paid vs market)
   */
  async getBenchmarkReport(
    organizationId: string,
    memberId: string,
    query: BenchmarkReportQueryDto,
  ): Promise<BenchmarkSummaryDto> {
    const allowedVehicleIds = await this.getAllowedVehicleIds(
      organizationId,
      memberId,
    );
    const state = query.state ?? 'SP'; // TODO: use organization.state when available

    const where: any = {
      organizationId,
      vehicleId: { in: allowedVehicleIds },
      marketPriceRef: { not: null },
    };

    if (query.vehicleId && allowedVehicleIds.includes(query.vehicleId)) {
      where.vehicleId = query.vehicleId;
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

    const logs = await this.prisma.fuelLog.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    let totalPaid = 0;
    let totalAtMarketPrice: number | null = 0;
    let totalOverpaid: number | null = 0;

    const logsWithMarket = logs.filter((log) => log.marketPriceRef !== null);

    logsWithMarket.forEach((log) => {
      totalPaid += log.totalCost;
      if (log.marketPriceRef) {
        const costAtMarket = log.liters * log.marketPriceRef;
        totalAtMarketPrice! += costAtMarket;
        totalOverpaid! += log.totalCost - costAtMarket;
      }
    });

    let overpaidPct: number | null = null;
    if (totalAtMarketPrice && totalAtMarketPrice > 0) {
      overpaidPct = parseFloat(
        ((totalOverpaid! / totalAtMarketPrice) * 100).toFixed(2),
      );
    }

    if (logsWithMarket.length === 0) {
      totalAtMarketPrice = null;
      totalOverpaid = null;
    }

    // Build time series (by month)
    const byMonth: Record<string, any[]> = {};
    logsWithMarket.forEach((log) => {
      const month = log.date.toISOString().slice(0, 7);
      if (!byMonth[month]) {
        byMonth[month] = [];
      }
      byMonth[month].push(log);
    });

    const timeSeries: BenchmarkPointDto[] = [];
    for (const [month, monthLogs] of Object.entries(byMonth)) {
      let avgPricePaid = 0;
      let avgMarketPrice: number | null = 0;

      const totalCost = monthLogs.reduce((sum, log) => sum + log.totalCost, 0);
      const totalLiters = monthLogs.reduce((sum, log) => sum + log.liters, 0);
      const marketCost = monthLogs.reduce(
        (sum, log) => sum + (log.liters * (log.marketPriceRef || 0)),
        0,
      );

      if (totalLiters > 0) {
        avgPricePaid = parseFloat((totalCost / totalLiters).toFixed(2));
        avgMarketPrice = parseFloat((marketCost / totalLiters).toFixed(2));
      }

      const difference = parseFloat(
        (avgPricePaid - avgMarketPrice).toFixed(2),
      );

      timeSeries.push({
        date: month,
        avgPricePaid,
        marketAvgPrice: avgMarketPrice,
        difference,
      });
    }

    return {
      totalPaid: parseFloat(totalPaid.toFixed(2)),
      totalAtMarketPrice: totalAtMarketPrice
        ? parseFloat(totalAtMarketPrice.toFixed(2))
        : null,
      totalOverpaid: totalOverpaid
        ? parseFloat(totalOverpaid.toFixed(2))
        : null,
      overpaidPct,
      timeSeries,
    };
  }

  /**
   * Get efficiency report (consumption drops)
   */
  async getEfficiencyReport(
    organizationId: string,
    memberId: string,
    query: EfficiencyReportQueryDto,
  ): Promise<VehicleEfficiencyDto[]> {
    const threshold = query.thresholdPct ?? 15;
    const allowedVehicleIds = await this.getAllowedVehicleIds(
      organizationId,
      memberId,
    );

    const logs = await this.prisma.fuelLog.findMany({
      where: {
        organizationId,
        vehicleId: { in: allowedVehicleIds },
      },
      include: {
        vehicle: {
          select: { id: true, name: true, plate: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    const byVehicle: Record<string, any[]> = {};
    logs.forEach((log) => {
      if (!byVehicle[log.vehicleId]) {
        byVehicle[log.vehicleId] = [];
      }
      byVehicle[log.vehicleId].push(log);
    });

    const result: VehicleEfficiencyDto[] = [];

    for (const [vehicleId, vehicleLogs] of Object.entries(byVehicle)) {
      const firstLog = vehicleLogs[0];
      const consumptionLogs = vehicleLogs.filter((l) => l.consumption !== null);

      if (consumptionLogs.length === 0) {
        continue;
      }

      const historicalAvg = parseFloat(
        (
          consumptionLogs.reduce((sum, log) => sum + log.consumption!, 0) /
          consumptionLogs.length
        ).toFixed(2),
      );

      const lastThree = consumptionLogs.slice(-3);
      let currentAvg: number | null = null;
      if (lastThree.length > 0) {
        currentAvg = parseFloat(
          (
            lastThree.reduce((sum, log) => sum + log.consumption!, 0) /
            lastThree.length
          ).toFixed(2),
        );
      }

      let consumptionDropPct: number | null = null;
      let isAlert = false;
      let estimatedExtraCost: number | null = null;

      if (currentAvg && historicalAvg > 0) {
        consumptionDropPct = parseFloat(
          (((historicalAvg - currentAvg) / historicalAvg) * 100).toFixed(2),
        );

        if (consumptionDropPct > threshold) {
          isAlert = true;

          // Estimate extra cost
          const lastLog = vehicleLogs[vehicleLogs.length - 1];
          const firstOdometer = vehicleLogs[0].odometer;
          const lastOdometer = lastLog.odometer;
          const totalKm = lastOdometer - firstOdometer;

          if (totalKm > 0) {
            const extraLiters =
              totalKm / currentAvg - totalKm / historicalAvg;
            const avgPricePaid = vehicleLogs.reduce(
              (sum, log) => sum + log.pricePerLiter,
              0,
            ) / vehicleLogs.length;
            estimatedExtraCost = parseFloat(
              (extraLiters * avgPricePaid).toFixed(2),
            );
          }
        }
      }

      result.push({
        vehicleId,
        vehicleName: firstLog.vehicle.name,
        vehiclePlate: firstLog.vehicle.plate,
        currentAvgConsumption: currentAvg,
        historicalAvgConsumption: historicalAvg,
        consumptionDropPct,
        isAlert,
        estimatedExtraCost,
        lastFuelDate: vehicleLogs[vehicleLogs.length - 1].date
          .toISOString()
          .split('T')[0],
      });
    }

    return result;
  }

  /**
   * Get summary report for a specific period
   */
  async getSummaryReport(
    organizationId: string,
    memberId: string,
    query: SummaryReportQueryDto,
  ): Promise<PeriodSummaryDto> {
    const allowedVehicleIds = await this.getAllowedVehicleIds(
      organizationId,
      memberId,
    );
    const refDate = new Date(query.date);

    const { start, end } = this.getPeriodBounds(refDate, query.period);
    const { prevStart, prevEnd } = this.getPreviousPeriodBounds(
      refDate,
      query.period,
    );

    const where: any = {
      organizationId,
      vehicleId: { in: allowedVehicleIds },
      date: { gte: start, lte: end },
    };

    if (query.vehicleId && allowedVehicleIds.includes(query.vehicleId)) {
      where.vehicleId = query.vehicleId;
    }

    const logs = await this.prisma.fuelLog.findMany({ where });
    const prevLogs = await this.prisma.fuelLog.findMany({
      where: {
        ...where,
        date: { gte: prevStart, lte: prevEnd },
      },
    });

    const summary = this.calculatePeriodStats(logs, start, end, query.period);
    const prevSummary = this.calculatePeriodStats(
      prevLogs,
      prevStart,
      prevEnd,
      query.period,
    );

    // Calculate changes
    let costChangePct: number | null = null;
    let consumptionChangePct: number | null = null;
    let litersChangePct: number | null = null;

    if (prevSummary.totalCost > 0) {
      costChangePct = parseFloat(
        (((summary.totalCost - prevSummary.totalCost) /
          prevSummary.totalCost) *
          100).toFixed(2),
      );
    }

    if (
      prevSummary.avgConsumption &&
      prevSummary.avgConsumption > 0 &&
      summary.avgConsumption
    ) {
      consumptionChangePct = parseFloat(
        (((summary.avgConsumption - prevSummary.avgConsumption) /
          prevSummary.avgConsumption) *
          100).toFixed(2),
      );
    }

    if (prevSummary.totalLiters > 0) {
      litersChangePct = parseFloat(
        (((summary.totalLiters - prevSummary.totalLiters) /
          prevSummary.totalLiters) *
          100).toFixed(2),
      );
    }

    const periodStr = this.formatPeriod(refDate, query.period);

    return {
      period: periodStr,
      totalCost: summary.totalCost,
      totalLiters: summary.totalLiters,
      logsCount: summary.logsCount,
      avgConsumption: summary.avgConsumption,
      avgPricePaid: summary.avgPricePaid,
      avgMarketPrice: summary.avgMarketPrice,
      costPerKm: summary.costPerKm,
      vsLastPeriod: {
        costChangePct,
        consumptionChangePct,
        litersChangePct,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────────────────

  private async getAllowedVehicleIds(
    organizationId: string,
    memberId: string,
  ): Promise<string[]> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const allowedCustomerIds =
      await this.customersService.getAllowedCustomerIds(member, organizationId);

    const allowedVehicleFilter = allowedCustomerIds !== null
      ? { customerId: { in: allowedCustomerIds } }
      : {};

    const vehicles = await this.prisma.vehicle.findMany({
      where: { organizationId, ...allowedVehicleFilter },
      select: { id: true },
    });

    return vehicles.map((v) => v.id);
  }

  private getPeriodBounds(
    date: Date,
    period: 'day' | 'month' | 'year',
  ): { start: Date; end: Date } {
    if (period === 'day') {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    } else if (period === 'month') {
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    } else {
      const start = new Date(date.getFullYear(), 0, 1);
      const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59);
      return { start, end };
    }
  }

  private getPreviousPeriodBounds(
    date: Date,
    period: 'day' | 'month' | 'year',
  ): { prevStart: Date; prevEnd: Date } {
    const prevDate = new Date(date);

    if (period === 'day') {
      prevDate.setDate(prevDate.getDate() - 1);
    } else if (period === 'month') {
      prevDate.setMonth(prevDate.getMonth() - 1);
    } else {
      prevDate.setFullYear(prevDate.getFullYear() - 1);
    }

    const { start: prevStart, end: prevEnd } = this.getPeriodBounds(prevDate, period);
    return { prevStart, prevEnd };
  }

  private formatPeriod(date: Date, period: 'day' | 'month' | 'year'): string {
    if (period === 'day') {
      return date.toISOString().split('T')[0];
    } else if (period === 'month') {
      return date.toISOString().slice(0, 7);
    } else {
      return date.getFullYear().toString();
    }
  }

  private calculatePeriodStats(
    logs: any[],
    start: Date,
    end: Date,
    period: string,
  ): any {
    const totalCost = logs.reduce((sum, log) => sum + log.totalCost, 0);
    const totalLiters = logs.reduce((sum, log) => sum + log.liters, 0);
    const logsCount = logs.length;

    let avgConsumption: number | null = null;
    if (logs.length > 1) {
      const consumptions = logs
        .filter((l) => l.consumption !== null)
        .map((l) => l.consumption);
      if (consumptions.length > 0) {
        avgConsumption = parseFloat(
          (consumptions.reduce((a, b) => a + b, 0) / consumptions.length).toFixed(
            2,
          ),
        );
      }
    }

    let avgPricePaid: number | null = null;
    if (totalLiters > 0) {
      avgPricePaid = parseFloat((totalCost / totalLiters).toFixed(2));
    }

    let avgMarketPrice: number | null = null;
    const logsWithMarket = logs.filter((l) => l.marketPriceRef !== null);
    if (logsWithMarket.length > 0) {
      const totalMarketCost = logsWithMarket.reduce(
        (sum, log) => sum + log.liters * log.marketPriceRef,
        0,
      );
      const marketLiters = logsWithMarket.reduce((sum, log) => sum + log.liters, 0);
      if (marketLiters > 0) {
        avgMarketPrice = parseFloat((totalMarketCost / marketLiters).toFixed(2));
      }
    }

    let costPerKm: number | null = null;
    if (logs.length > 1) {
      const firstOdometer = logs[0].odometer;
      const lastOdometer = logs[logs.length - 1].odometer;
      const totalKm = lastOdometer - firstOdometer;
      if (totalKm > 0) {
        costPerKm = parseFloat((totalCost / totalKm).toFixed(4));
      }
    }

    return {
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalLiters: parseFloat(totalLiters.toFixed(2)),
      logsCount,
      avgConsumption,
      avgPricePaid,
      avgMarketPrice,
      costPerKm,
    };
  }
}

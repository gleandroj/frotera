import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { FuelReportsService } from './fuel-reports.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomersService } from '@/customers/customers.service';
import { FuelPriceApiService } from '@/fuel/fuel-price-api.service';
import {
  ConsumptionReportQueryDto,
  CostsReportQueryDto,
  BenchmarkReportQueryDto,
  EfficiencyReportQueryDto,
  SummaryReportQueryDto,
} from './fuel-reports.dto';

describe('FuelReportsService', () => {
  let service: FuelReportsService;

  const mockPrisma = {
    organizationMember: { findFirst: jest.fn() },
    vehicle: { findMany: jest.fn() },
    fuelLog: { findMany: jest.fn() },
    fuelPriceSnapshot: { findFirst: jest.fn() },
  };

  const mockCustomersService = {
    getAllowedCustomerIds: jest.fn().mockResolvedValue(null),
  };

  const mockFuelPriceApiService = {
    getPriceHistory: jest.fn().mockResolvedValue([]),
  };

  // Test data
  const orgId = 'org-1';
  const memberId = 'member-1';

  const mockMember = {
    id: memberId,
    userId: 'user-1',
    organizationId: orgId,
  };

  const mockLogs = [
    {
      id: 'l1',
      vehicleId: 'v1',
      date: new Date('2026-01-01'),
      odometer: 1000,
      liters: 50,
      pricePerLiter: 6.0,
      totalCost: 300,
      consumption: null,
      marketPriceRef: 5.8,
      fuelType: 'GASOLINE',
      vehicle: { id: 'v1', name: 'Car A', plate: 'AAA-1111' },
    },
    {
      id: 'l2',
      vehicleId: 'v1',
      date: new Date('2026-02-01'),
      odometer: 2000,
      liters: 45,
      pricePerLiter: 6.2,
      totalCost: 279,
      consumption: 22.2,
      marketPriceRef: 6.0,
      fuelType: 'GASOLINE',
      vehicle: { id: 'v1', name: 'Car A', plate: 'AAA-1111' },
    },
    {
      id: 'l3',
      vehicleId: 'v1',
      date: new Date('2026-03-01'),
      odometer: 3000,
      liters: 48,
      pricePerLiter: 6.5,
      totalCost: 312,
      consumption: 20.8,
      marketPriceRef: 6.1,
      fuelType: 'GASOLINE',
      vehicle: { id: 'v1', name: 'Car A', plate: 'AAA-1111' },
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FuelReportsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CustomersService,
          useValue: mockCustomersService,
        },
        {
          provide: FuelPriceApiService,
          useValue: mockFuelPriceApiService,
        },
      ],
    }).compile();

    service = module.get<FuelReportsService>(FuelReportsService);
  });

  describe('getConsumptionReport', () => {
    it('should throw ForbiddenException when member not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      const query: ConsumptionReportQueryDto = {};

      await expect(
        service.getConsumptionReport(orgId, memberId, query),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return array of VehicleConsumptionDto with avgConsumption calculated', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue(mockLogs);

      const query: ConsumptionReportQueryDto = {};

      const result = await service.getConsumptionReport(orgId, memberId, query);

      expect(result).toHaveLength(1);
      expect(result[0].vehicleId).toBe('v1');
      expect(result[0].avgConsumption).toBe(21.5);
      expect(result[0].bestConsumption).toBe(22.2);
      expect(result[0].worstConsumption).toBe(20.8);
    });

    it("should set trend to 'insufficient_data' when < 3 records", async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([mockLogs[0], mockLogs[1]]);

      const query: ConsumptionReportQueryDto = {};

      const result = await service.getConsumptionReport(orgId, memberId, query);

      expect(result[0].trend).toBe('insufficient_data');
    });

    it("should set trend to 'improving' when second half is > 5% better", async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([
        {
          ...mockLogs[0],
          consumption: 10.0,
        },
        {
          ...mockLogs[1],
          consumption: 10.5,
        },
        {
          ...mockLogs[2],
          consumption: 12.0,
        },
      ]);

      const query: ConsumptionReportQueryDto = {};

      const result = await service.getConsumptionReport(orgId, memberId, query);

      expect(result[0].trend).toBe('improving');
    });

    it("should set trend to 'worsening' when second half is > 5% worse", async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([
        {
          ...mockLogs[0],
          consumption: 12.0,
        },
        {
          ...mockLogs[1],
          consumption: 11.5,
        },
        {
          ...mockLogs[2],
          consumption: 10.0,
        },
      ]);

      const query: ConsumptionReportQueryDto = {};

      const result = await service.getConsumptionReport(orgId, memberId, query);

      expect(result[0].trend).toBe('worsening');
    });

    it("should set trend to 'stable' when difference <= 5%", async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([
        {
          ...mockLogs[0],
          consumption: 10.0,
        },
        {
          ...mockLogs[1],
          consumption: 10.2,
        },
        {
          ...mockLogs[2],
          consumption: 10.1,
        },
      ]);

      const query: ConsumptionReportQueryDto = {};

      const result = await service.getConsumptionReport(orgId, memberId, query);

      expect(result[0].trend).toBe('stable');
    });
  });

  describe('getCostsReport', () => {
    it('should throw ForbiddenException when member not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      const query: CostsReportQueryDto = {};

      await expect(
        service.getCostsReport(orgId, memberId, query),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should group by month when groupBy='month'", async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue(mockLogs);

      const query: CostsReportQueryDto = { groupBy: 'month' };

      const result = await service.getCostsReport(orgId, memberId, query);

      expect(result).toHaveLength(3);
      expect(result[0].period).toBe('2026-01');
      expect(result[1].period).toBe('2026-02');
      expect(result[2].period).toBe('2026-03');
    });

    it("should group by day when groupBy='day'", async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([mockLogs[0]]);

      const query: CostsReportQueryDto = { groupBy: 'day' };

      const result = await service.getCostsReport(orgId, memberId, query);

      expect(result[0].period).toBe('2026-01-01');
    });

    it("should group by year when groupBy='year'", async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([mockLogs[0]]);

      const query: CostsReportQueryDto = { groupBy: 'year' };

      const result = await service.getCostsReport(orgId, memberId, query);

      expect(result.length).toBeGreaterThan(0);
      // Check that at least one result contains year information
      expect(result.some(r => r.period.match(/^\d{4}$/))).toBe(true);
    });

    it('should include byFuelType breakdown', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([mockLogs[0]]);

      const query: CostsReportQueryDto = { groupBy: 'month' };

      const result = await service.getCostsReport(orgId, memberId, query);

      expect(result[0].byFuelType).toBeDefined();
      expect(result[0].byFuelType['GASOLINE']).toBeDefined();
      expect(result[0].byFuelType['GASOLINE'].cost).toBe(300);
    });
  });

  describe('getBenchmarkReport', () => {
    it('should throw ForbiddenException when member not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      const query: BenchmarkReportQueryDto = {};

      await expect(
        service.getBenchmarkReport(orgId, memberId, query),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should calculate totalOverpaid correctly', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue(mockLogs);

      const query: BenchmarkReportQueryDto = {};

      const result = await service.getBenchmarkReport(orgId, memberId, query);

      // Log 1: (6.0 - 5.8) * 50 = 10
      // Log 2: (6.2 - 6.0) * 45 = 9
      // Log 3: (6.5 - 6.1) * 48 = 19.2
      // Total overpaid = 38.2
      expect(result.totalOverpaid).toBe(38.2);
    });

    it('should set totalAtMarketPrice to null when no snapshots with marketPriceRef', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([
        { ...mockLogs[0], marketPriceRef: null },
        { ...mockLogs[1], marketPriceRef: null },
      ]);

      const query: BenchmarkReportQueryDto = {};

      const result = await service.getBenchmarkReport(orgId, memberId, query);

      expect(result.totalAtMarketPrice).toBeNull();
      expect(result.totalOverpaid).toBeNull();
    });

    it('should have timeSeries for monthly breakdown', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue(mockLogs);

      const query: BenchmarkReportQueryDto = {};

      const result = await service.getBenchmarkReport(orgId, memberId, query);

      expect(result.timeSeries).toHaveLength(3);
      expect(result.timeSeries[0].date).toBe('2026-01');
    });
  });

  describe('getEfficiencyReport', () => {
    it('should throw ForbiddenException when member not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      const query: EfficiencyReportQueryDto = {};

      await expect(
        service.getEfficiencyReport(orgId, memberId, query),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should set isAlert=true when consumptionDropPct > thresholdPct', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([
        { ...mockLogs[0], consumption: 20.0, pricePerLiter: 6.0 },
        { ...mockLogs[1], consumption: 19.0, pricePerLiter: 6.0 },
        { ...mockLogs[2], consumption: 18.0, pricePerLiter: 6.0 },
        {
          ...mockLogs[2],
          id: 'l4',
          odometer: 4000,
          consumption: 10.0,
          pricePerLiter: 6.0,
        },
        {
          ...mockLogs[2],
          id: 'l5',
          odometer: 5000,
          consumption: 9.0,
          pricePerLiter: 6.0,
        },
        {
          ...mockLogs[2],
          id: 'l6',
          odometer: 6000,
          consumption: 8.5,
          pricePerLiter: 6.0,
        },
      ]);

      const query: EfficiencyReportQueryDto = { thresholdPct: 15 };

      const result = await service.getEfficiencyReport(orgId, memberId, query);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].isAlert).toBe(true);
    });

    it('should set isAlert=false when consumptionDropPct <= thresholdPct', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([
        { ...mockLogs[0], consumption: 10.0, pricePerLiter: 6.0 },
        { ...mockLogs[1], consumption: 10.2, pricePerLiter: 6.0 },
        { ...mockLogs[2], consumption: 10.1, pricePerLiter: 6.0 },
      ]);

      const query: EfficiencyReportQueryDto = { thresholdPct: 15 };

      const result = await service.getEfficiencyReport(orgId, memberId, query);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].isAlert).toBe(false);
    });

    it('should calculate estimatedExtraCost correctly', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([
        {
          ...mockLogs[0],
          consumption: 20.0,
          pricePerLiter: 6.0,
          odometer: 1000,
        },
        {
          ...mockLogs[1],
          consumption: 19.0,
          pricePerLiter: 6.0,
          odometer: 2000,
        },
        {
          ...mockLogs[2],
          consumption: 18.0,
          pricePerLiter: 6.0,
          odometer: 3000,
        },
        {
          ...mockLogs[2],
          id: 'l4',
          odometer: 4000,
          consumption: 10.0,
          pricePerLiter: 6.0,
        },
        {
          ...mockLogs[2],
          id: 'l5',
          odometer: 5000,
          consumption: 9.5,
          pricePerLiter: 6.0,
        },
        {
          ...mockLogs[2],
          id: 'l6',
          odometer: 6000,
          consumption: 9.0,
          pricePerLiter: 6.0,
        },
      ]);

      const query: EfficiencyReportQueryDto = { thresholdPct: 15 };

      const result = await service.getEfficiencyReport(orgId, memberId, query);

      expect(result[0].estimatedExtraCost).toBeDefined();
      expect(result[0].estimatedExtraCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getSummaryReport', () => {
    it('should throw ForbiddenException when member not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      const query: SummaryReportQueryDto = {
        period: 'month',
        date: '2026-04-16',
      };

      await expect(
        service.getSummaryReport(orgId, memberId, query),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return correct stats for the period', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([mockLogs[0]]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([]);

      const query: SummaryReportQueryDto = {
        period: 'month',
        date: '2026-01-15',
        vehicleId: undefined,
      };

      const result = await service.getSummaryReport(orgId, memberId, query);

      expect(result.period).toBe('2026-01');
      expect(result.totalCost).toBe(300);
      expect(result.totalLiters).toBe(50);
      expect(result.logsCount).toBe(1);
    });

    it('should calculate vsLastPeriod.costChangePct when there are data from previous period', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([
        { ...mockLogs[1], totalCost: 300, liters: 50, consumption: 20.0 },
      ]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([
        { ...mockLogs[0], totalCost: 250, liters: 50, consumption: 20.0 },
      ]);

      const query: SummaryReportQueryDto = {
        period: 'month',
        date: '2026-02-15',
      };

      const result = await service.getSummaryReport(orgId, memberId, query);

      expect(result.vsLastPeriod.costChangePct).toBe(20);
    });

    it('should set vsLastPeriod values to null when no previous data', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'v1' }]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([mockLogs[0]]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([]);

      const query: SummaryReportQueryDto = {
        period: 'month',
        date: '2026-01-15',
      };

      const result = await service.getSummaryReport(orgId, memberId, query);

      expect(result.vsLastPeriod.costChangePct).toBeNull();
      expect(result.vsLastPeriod.consumptionChangePct).toBeNull();
      expect(result.vsLastPeriod.litersChangePct).toBeNull();
    });
  });
});

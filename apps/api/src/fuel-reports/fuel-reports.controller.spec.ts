import { Test, TestingModule } from '@nestjs/testing';
import { FuelReportsController } from './fuel-reports.controller';
import { FuelReportsService } from './fuel-reports.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { OrganizationMemberGuard } from '@/organizations/guards/organization-member.guard';
import { PermissionGuard } from '@/auth/guards/permission.guard';
import {
  ConsumptionReportQueryDto,
  CostsReportQueryDto,
  BenchmarkReportQueryDto,
  EfficiencyReportQueryDto,
  SummaryReportQueryDto,
  VehicleConsumptionDto,
  CostsPeriodDto,
  BenchmarkSummaryDto,
  VehicleEfficiencyDto,
  PeriodSummaryDto,
} from './fuel-reports.dto';

describe('FuelReportsController', () => {
  let controller: FuelReportsController;
  let service: FuelReportsService;

  const mockFuelReportsService = {
    getConsumptionReport: jest.fn(),
    getCostsReport: jest.fn(),
    getBenchmarkReport: jest.fn(),
    getEfficiencyReport: jest.fn(),
    getSummaryReport: jest.fn(),
  };

  // Test data
  const orgId = 'org-1';
  const memberId = 'member-1';

  const mockRequest = {
    organizationMember: { id: memberId },
  };

  const mockConsumptionReport: VehicleConsumptionDto[] = [
    {
      vehicleId: 'v1',
      vehicleName: 'Car A',
      vehiclePlate: 'AAA-1111',
      avgConsumption: 21.5,
      bestConsumption: 22.2,
      worstConsumption: 20.8,
      totalKm: 2000,
      totalLiters: 93,
      logsCount: 3,
      trend: 'stable',
      timeSeries: [
        { date: '2026-01-01', consumption: null },
        { date: '2026-02-01', consumption: 22.2 },
        { date: '2026-03-01', consumption: 20.8 },
      ],
    },
  ];

  const mockCostsReport: CostsPeriodDto[] = [
    {
      period: '2026-01',
      totalCost: 300,
      totalLiters: 50,
      logsCount: 1,
      avgPricePerLiter: 6.0,
      costPerKm: 0.3,
      byFuelType: {
        GASOLINE: { cost: 300, liters: 50 },
      },
    },
    {
      period: '2026-02',
      totalCost: 279,
      totalLiters: 45,
      logsCount: 1,
      avgPricePerLiter: 6.2,
      costPerKm: 0.279,
      byFuelType: {
        GASOLINE: { cost: 279, liters: 45 },
      },
    },
  ];

  const mockBenchmarkReport: BenchmarkSummaryDto = {
    totalPaid: 891,
    totalAtMarketPrice: 852.8,
    totalOverpaid: 38.2,
    overpaidPct: 4.48,
    timeSeries: [
      {
        date: '2026-01',
        avgPricePaid: 6.0,
        marketAvgPrice: 5.8,
        difference: 0.2,
      },
      {
        date: '2026-02',
        avgPricePaid: 6.2,
        marketAvgPrice: 6.0,
        difference: 0.2,
      },
    ],
  };

  const mockEfficiencyReport: VehicleEfficiencyDto[] = [
    {
      vehicleId: 'v1',
      vehicleName: 'Car A',
      vehiclePlate: 'AAA-1111',
      currentAvgConsumption: 9.17,
      historicalAvgConsumption: 21.5,
      consumptionDropPct: 57.35,
      isAlert: true,
      estimatedExtraCost: 450.25,
      lastFuelDate: '2026-03-01',
    },
  ];

  const mockSummaryReport: PeriodSummaryDto = {
    period: '2026-01',
    totalCost: 300,
    totalLiters: 50,
    logsCount: 1,
    avgConsumption: null,
    avgPricePaid: 6.0,
    avgMarketPrice: 5.8,
    costPerKm: null,
    vsLastPeriod: {
      costChangePct: null,
      consumptionChangePct: null,
      litersChangePct: null,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FuelReportsController],
      providers: [
        {
          provide: FuelReportsService,
          useValue: mockFuelReportsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(OrganizationMemberGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<FuelReportsController>(FuelReportsController);
    service = module.get<FuelReportsService>(FuelReportsService);
  });

  describe('getConsumption', () => {
    it('should call fuelReportsService.getConsumptionReport with member context', async () => {
      mockFuelReportsService.getConsumptionReport.mockResolvedValue(
        mockConsumptionReport,
      );

      const query: ConsumptionReportQueryDto = {};

      const result = await controller.getConsumption(
        mockRequest as any,
        orgId,
        query,
      );

      expect(
        mockFuelReportsService.getConsumptionReport,
      ).toHaveBeenCalledWith(orgId, memberId, query);
      expect(result).toHaveLength(1);
      expect(result[0].vehicleId).toBe('v1');
    });

    it('should pass filters to service', async () => {
      mockFuelReportsService.getConsumptionReport.mockResolvedValue(
        mockConsumptionReport,
      );

      const query: ConsumptionReportQueryDto = {
        vehicleId: 'v1',
        dateFrom: '2026-01-01',
        dateTo: '2026-03-31',
      };

      await controller.getConsumption(mockRequest as any, orgId, query);

      expect(
        mockFuelReportsService.getConsumptionReport,
      ).toHaveBeenCalledWith(orgId, memberId, query);
    });

    it('should return consumption report with trend analysis', async () => {
      mockFuelReportsService.getConsumptionReport.mockResolvedValue(
        mockConsumptionReport,
      );

      const query: ConsumptionReportQueryDto = {};

      const result = await controller.getConsumption(
        mockRequest as any,
        orgId,
        query,
      );

      expect(result[0].trend).toBe('stable');
      expect(result[0].avgConsumption).toBe(21.5);
      expect(result[0].timeSeries).toBeDefined();
    });
  });

  describe('getCosts', () => {
    it('should call fuelReportsService.getCostsReport with member context', async () => {
      mockFuelReportsService.getCostsReport.mockResolvedValue(mockCostsReport);

      const query: CostsReportQueryDto = {};

      const result = await controller.getCosts(mockRequest as any, orgId, query);

      expect(mockFuelReportsService.getCostsReport).toHaveBeenCalledWith(
        orgId,
        memberId,
        query,
      );
      expect(result).toHaveLength(2);
    });

    it('should support different groupBy options', async () => {
      mockFuelReportsService.getCostsReport.mockResolvedValue(mockCostsReport);

      const queries = [
        { groupBy: 'day' as const },
        { groupBy: 'month' as const },
        { groupBy: 'year' as const },
      ];

      for (const query of queries) {
        mockFuelReportsService.getCostsReport.mockResolvedValue(mockCostsReport);
        await controller.getCosts(mockRequest as any, orgId, query);
        expect(mockFuelReportsService.getCostsReport).toHaveBeenCalledWith(
          orgId,
          memberId,
          query,
        );
      }
    });

    it('should return costs report with fuel type breakdown', async () => {
      mockFuelReportsService.getCostsReport.mockResolvedValue(mockCostsReport);

      const query: CostsReportQueryDto = { groupBy: 'month' };

      const result = await controller.getCosts(mockRequest as any, orgId, query);

      expect(result[0].byFuelType).toBeDefined();
      expect(result[0].byFuelType['GASOLINE']).toBeDefined();
    });
  });

  describe('getBenchmark', () => {
    it('should call fuelReportsService.getBenchmarkReport with member context', async () => {
      mockFuelReportsService.getBenchmarkReport.mockResolvedValue(
        mockBenchmarkReport,
      );

      const query: BenchmarkReportQueryDto = {};

      const result = await controller.getBenchmark(
        mockRequest as any,
        orgId,
        query,
      );

      expect(mockFuelReportsService.getBenchmarkReport).toHaveBeenCalledWith(
        orgId,
        memberId,
        query,
      );
      expect(result.totalPaid).toBe(891);
    });

    it('should pass state parameter to service', async () => {
      mockFuelReportsService.getBenchmarkReport.mockResolvedValue(
        mockBenchmarkReport,
      );

      const query: BenchmarkReportQueryDto = { state: 'RJ' };

      await controller.getBenchmark(mockRequest as any, orgId, query);

      expect(mockFuelReportsService.getBenchmarkReport).toHaveBeenCalledWith(
        orgId,
        memberId,
        query,
      );
    });

    it('should return benchmark report with overpaid information', async () => {
      mockFuelReportsService.getBenchmarkReport.mockResolvedValue(
        mockBenchmarkReport,
      );

      const query: BenchmarkReportQueryDto = {};

      const result = await controller.getBenchmark(
        mockRequest as any,
        orgId,
        query,
      );

      expect(result.totalAtMarketPrice).toBe(852.8);
      expect(result.totalOverpaid).toBe(38.2);
      expect(result.overpaidPct).toBe(4.48);
      expect(result.timeSeries).toBeDefined();
    });
  });

  describe('getEfficiency', () => {
    it('should call fuelReportsService.getEfficiencyReport with member context', async () => {
      mockFuelReportsService.getEfficiencyReport.mockResolvedValue(
        mockEfficiencyReport,
      );

      const query: EfficiencyReportQueryDto = {};

      const result = await controller.getEfficiency(
        mockRequest as any,
        orgId,
        query,
      );

      expect(mockFuelReportsService.getEfficiencyReport).toHaveBeenCalledWith(
        orgId,
        memberId,
        query,
      );
      expect(result).toHaveLength(1);
    });

    it('should pass threshold parameter to service', async () => {
      mockFuelReportsService.getEfficiencyReport.mockResolvedValue(
        mockEfficiencyReport,
      );

      const query: EfficiencyReportQueryDto = { thresholdPct: 20 };

      await controller.getEfficiency(mockRequest as any, orgId, query);

      expect(mockFuelReportsService.getEfficiencyReport).toHaveBeenCalledWith(
        orgId,
        memberId,
        query,
      );
    });

    it('should return efficiency report with alerts', async () => {
      mockFuelReportsService.getEfficiencyReport.mockResolvedValue(
        mockEfficiencyReport,
      );

      const query: EfficiencyReportQueryDto = {};

      const result = await controller.getEfficiency(
        mockRequest as any,
        orgId,
        query,
      );

      expect(result[0].isAlert).toBe(true);
      expect(result[0].consumptionDropPct).toBe(57.35);
      expect(result[0].estimatedExtraCost).toBe(450.25);
    });
  });

  describe('getSummary', () => {
    it('should call fuelReportsService.getSummaryReport with member context', async () => {
      mockFuelReportsService.getSummaryReport.mockResolvedValue(
        mockSummaryReport,
      );

      const query: SummaryReportQueryDto = {
        period: 'month',
        date: '2026-01-15',
      };

      const result = await controller.getSummary(mockRequest as any, orgId, query);

      expect(mockFuelReportsService.getSummaryReport).toHaveBeenCalledWith(
        orgId,
        memberId,
        query,
      );
      expect(result.period).toBe('2026-01');
    });

    it('should support different period types', async () => {
      mockFuelReportsService.getSummaryReport.mockResolvedValue(
        mockSummaryReport,
      );

      const periods = ['day', 'month', 'year'] as const;

      for (const period of periods) {
        mockFuelReportsService.getSummaryReport.mockResolvedValue(
          mockSummaryReport,
        );

        const query: SummaryReportQueryDto = {
          period,
          date: '2026-01-15',
        };

        await controller.getSummary(mockRequest as any, orgId, query);

        expect(mockFuelReportsService.getSummaryReport).toHaveBeenCalledWith(
          orgId,
          memberId,
          query,
        );
      }
    });

    it('should support filtering by vehicle', async () => {
      mockFuelReportsService.getSummaryReport.mockResolvedValue(
        mockSummaryReport,
      );

      const query: SummaryReportQueryDto = {
        period: 'month',
        date: '2026-01-15',
        vehicleId: 'v1',
      };

      await controller.getSummary(mockRequest as any, orgId, query);

      expect(mockFuelReportsService.getSummaryReport).toHaveBeenCalledWith(
        orgId,
        memberId,
        query,
      );
    });

    it('should return summary report with period comparison', async () => {
      mockFuelReportsService.getSummaryReport.mockResolvedValue(
        mockSummaryReport,
      );

      const query: SummaryReportQueryDto = {
        period: 'month',
        date: '2026-01-15',
      };

      const result = await controller.getSummary(mockRequest as any, orgId, query);

      expect(result.totalCost).toBe(300);
      expect(result.totalLiters).toBe(50);
      expect(result.vsLastPeriod).toBeDefined();
      expect(result.vsLastPeriod.costChangePct).toBeNull();
    });
  });
});

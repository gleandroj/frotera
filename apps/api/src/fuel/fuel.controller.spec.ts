import { Test, TestingModule } from '@nestjs/testing';
import { FuelController } from './fuel.controller';
import { FuelService } from './fuel.service';
import { FuelGeoService } from './fuel-geo.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { OrganizationMemberGuard } from '@/organizations/guards/organization-member.guard';
import { PermissionGuard } from '@/auth/guards/permission.guard';
import {
  CreateFuelLogDto,
  UpdateFuelLogDto,
  ListFuelLogsQueryDto,
  FuelStatsQueryDto,
  FuelTypeEnum,
  FuelLogResponseDto,
  FuelStatsResponseDto,
} from './fuel.dto';

describe('FuelController', () => {
  let controller: FuelController;
  let service: FuelService;

  const mockFuelService = {
    list: jest.fn(),
    create: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getStats: jest.fn(),
    getMarketPrices: jest.fn(),
    uploadReceipt: jest.fn(),
  };

  const mockFuelGeoService = {
    listEstados: jest.fn().mockResolvedValue([]),
    listMunicipios: jest.fn().mockResolvedValue([]),
  };

  // Test data
  const orgId = 'org-1';
  const userId = 'user-1';
  const logId = 'log-1';

  const mockFuelLog: FuelLogResponseDto = {
    id: logId,
    organizationId: orgId,
    vehicleId: 'vehicle-1',
    driverId: undefined,
    createdById: 'member-1',
    date: '2026-04-01T00:00:00Z',
    odometer: 10000,
    liters: 50,
    pricePerLiter: 6.5,
    totalCost: 325,
    fuelType: FuelTypeEnum.GASOLINE,
    station: undefined,
    state: undefined,
    city: undefined,
    receipt: undefined,
    notes: undefined,
    consumption: null,
    marketPriceRef: null,
    createdAt: '2026-04-16T10:00:00Z',
    updatedAt: '2026-04-16T10:00:00Z',
    vehicle: {
      id: 'vehicle-1',
      name: 'Toyota Hilux',
      plate: 'ABC-1234',
    },
  };

  const mockStats: FuelStatsResponseDto = {
    totalCost: 625,
    totalLiters: 95,
    count: 2,
    avgConsumption: 21.05,
    avgCostPerKm: 0.0625,
    currentMonthCost: 325,
    currentMonthCount: 1,
  };

  const mockRequest = {
    user: {
      userId,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FuelController],
      providers: [
        {
          provide: FuelService,
          useValue: mockFuelService,
        },
        {
          provide: FuelGeoService,
          useValue: mockFuelGeoService,
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

    controller = module.get<FuelController>(FuelController);
    service = module.get<FuelService>(FuelService);
  });

  describe('getMarketPrices', () => {
    it('should call fuelService.getMarketPrices', async () => {
      const state = 'SP';
      const fuelType = FuelTypeEnum.GASOLINE;
      const expected = { avgPrice: 6.69, refDate: '2026-04-16' };

      mockFuelService.getMarketPrices.mockResolvedValue(expected);

      const result = await controller.getMarketPrices(orgId, state, fuelType);

      expect(mockFuelService.getMarketPrices).toHaveBeenCalledWith(
        state,
        fuelType,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getStats', () => {
    it('should call fuelService.getStats with user context', async () => {
      mockFuelService.getStats.mockResolvedValue(mockStats);

      const query: FuelStatsQueryDto = {};

      const result = await controller.getStats(mockRequest as any, orgId, query);

      expect(mockFuelService.getStats).toHaveBeenCalledWith(orgId, userId, query, null);
      expect(result).toEqual(mockStats);
    });

    it('should pass filters to service', async () => {
      mockFuelService.getStats.mockResolvedValue(mockStats);

      const query: FuelStatsQueryDto = {
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        dateFrom: '2026-04-01',
        dateTo: '2026-04-30',
      };

      await controller.getStats(mockRequest as any, orgId, query);

      expect(mockFuelService.getStats).toHaveBeenCalledWith(orgId, userId, query, null);
    });
  });

  describe('list', () => {
    it('should call fuelService.list with user context', async () => {
      mockFuelService.list.mockResolvedValue([mockFuelLog]);

      const query: ListFuelLogsQueryDto = {};

      const result = await controller.list(mockRequest as any, orgId, query);

      expect(mockFuelService.list).toHaveBeenCalledWith(orgId, userId, query, null);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(logId);
    });

    it('should pass filters to service', async () => {
      mockFuelService.list.mockResolvedValue([mockFuelLog]);

      const query: ListFuelLogsQueryDto = {
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        dateFrom: '2026-04-01',
        dateTo: '2026-04-30',
        fuelType: FuelTypeEnum.DIESEL,
      };

      await controller.list(mockRequest as any, orgId, query);

      expect(mockFuelService.list).toHaveBeenCalledWith(orgId, userId, query, null);
    });

    it('should return empty array when no logs found', async () => {
      mockFuelService.list.mockResolvedValue([]);

      const query: ListFuelLogsQueryDto = {};

      const result = await controller.list(mockRequest as any, orgId, query);

      expect(result).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('should call fuelService.create with user context', async () => {
      mockFuelService.create.mockResolvedValue(mockFuelLog);

      const dto: CreateFuelLogDto = {
        vehicleId: 'vehicle-1',
        date: '2026-04-01',
        odometer: 10000,
        liters: 50,
        pricePerLiter: 6.5,
        fuelType: FuelTypeEnum.GASOLINE,
      };

      const result = await controller.create(mockRequest as any, orgId, dto);

      expect(mockFuelService.create).toHaveBeenCalledWith(orgId, userId, dto, null);
      expect(result.id).toBe(logId);
    });

    it('should pass optional fields to service', async () => {
      mockFuelService.create.mockResolvedValue(mockFuelLog);

      const dto: CreateFuelLogDto = {
        vehicleId: 'vehicle-1',
        date: '2026-04-01',
        odometer: 10000,
        liters: 50,
        pricePerLiter: 6.5,
        fuelType: FuelTypeEnum.GASOLINE,
        driverId: 'driver-1',
        station: 'Petrobras',
        city: 'São Paulo',
        receipt: 'https://s3.example.com/receipt.png',
        notes: 'Full tank',
      };

      await controller.create(mockRequest as any, orgId, dto);

      expect(mockFuelService.create).toHaveBeenCalledWith(orgId, userId, dto, null);
    });
  });

  describe('getOne', () => {
    it('should call fuelService.getById with user context', async () => {
      mockFuelService.getById.mockResolvedValue(mockFuelLog);

      const result = await controller.getOne(mockRequest as any, orgId, logId);

      expect(mockFuelService.getById).toHaveBeenCalledWith(logId, orgId, userId, null);
      expect(result.id).toBe(logId);
    });
  });

  describe('update', () => {
    it('should call fuelService.update with user context', async () => {
      const updatedLog = { ...mockFuelLog, liters: 60 };
      mockFuelService.update.mockResolvedValue(updatedLog);

      const dto: UpdateFuelLogDto = {
        liters: 60,
      };

      const result = await controller.update(
        mockRequest as any,
        orgId,
        logId,
        dto,
      );

      expect(mockFuelService.update).toHaveBeenCalledWith(logId, orgId, userId, dto, null);
      expect(result.liters).toBe(60);
    });

    it('should pass partial update to service', async () => {
      mockFuelService.update.mockResolvedValue(mockFuelLog);

      const dto: UpdateFuelLogDto = {
        pricePerLiter: 7.0,
        driverId: 'driver-2',
      };

      await controller.update(mockRequest as any, orgId, logId, dto);

      expect(mockFuelService.update).toHaveBeenCalledWith(logId, orgId, userId, dto, null);
    });
  });

  describe('delete', () => {
    it('should call fuelService.delete with user context', async () => {
      mockFuelService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(mockRequest as any, orgId, logId);

      expect(mockFuelService.delete).toHaveBeenCalledWith(logId, orgId, userId, null);
      expect(result.message).toBe('Fuel log deleted successfully');
    });

    it('should return success message', async () => {
      mockFuelService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(mockRequest as any, orgId, logId);

      expect(result).toEqual({ message: 'Fuel log deleted successfully' });
    });
  });
});

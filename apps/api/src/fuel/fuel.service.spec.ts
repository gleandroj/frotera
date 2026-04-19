import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FuelService } from './fuel.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomersService } from '@/customers/customers.service';
import { S3Service } from '@/utils/s3.service';
import { FuelPriceApiService } from './fuel-price-api.service';
import { ApiCode } from '@/common/api-codes.enum';
import {
  CreateFuelLogDto,
  UpdateFuelLogDto,
  ListFuelLogsQueryDto,
  FuelStatsQueryDto,
  FuelTypeEnum,
} from './fuel.dto';

describe('FuelService', () => {
  let service: FuelService;
  let prismaService: PrismaService;
  let customersService: CustomersService;
  let fuelPriceApiService: FuelPriceApiService;

  const mockPrisma = {
    organizationMember: { findFirst: jest.fn() },
    vehicle: { findMany: jest.fn(), findFirst: jest.fn() },
    fuelLog: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organization: { findFirst: jest.fn() },
  };

  const mockCustomersService = {
    getAllowedCustomerIds: jest.fn().mockResolvedValue(null),
  };

  const mockFuelPriceApiService = {
    getLatestPrice: jest.fn().mockResolvedValue(null),
  };

  const mockS3Service = {
    uploadFile: jest.fn().mockResolvedValue('https://s3.example.com/receipt.jpg'),
  };

  // Test data
  const orgId = 'org-1';
  const userId = 'user-1';
  const memberId = 'member-1';
  const vehicleId = 'vehicle-1';

  const mockMember = {
    id: memberId,
    userId,
    organizationId: orgId,
    customerRestricted: false,
  };

  const mockVehicle = {
    id: vehicleId,
    organizationId: orgId,
    customerId: null,
    customer: null,
  };

  const fuelLogListInclude = {
    vehicle: {
      select: { id: true, name: true, plate: true },
    },
    driver: { select: { id: true, name: true } },
  };

  const mockFuelLog = {
    id: 'log-1',
    organizationId: orgId,
    vehicleId,
    driverId: null,
    createdById: memberId,
    date: new Date('2026-04-01'),
    odometer: 10000,
    liters: 50,
    pricePerLiter: 6.5,
    totalCost: 325,
    fuelType: FuelTypeEnum.GASOLINE,
    station: null,
    state: null,
    city: null,
    receipt: null,
    notes: null,
    consumption: null,
    marketPriceRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    vehicle: { id: vehicleId, name: 'Toyota Hilux', plate: 'ABC-1234' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FuelService,
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
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    service = module.get<FuelService>(FuelService);
    prismaService = module.get<PrismaService>(PrismaService);
    customersService = module.get<CustomersService>(CustomersService);
    fuelPriceApiService = module.get<FuelPriceApiService>(FuelPriceApiService);
  });

  describe('list', () => {
    it('should throw ForbiddenException when member not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      const query: ListFuelLogsQueryDto = {};

      await expect(
        service.list(orgId, userId, query),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should list all logs from organization without filters', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([
        { id: vehicleId },
        { id: 'vehicle-2' },
      ]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([mockFuelLog]);

      const query: ListFuelLogsQueryDto = {};

      const result = await service.list(orgId, userId, query);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockFuelLog.id);
      expect(mockPrisma.fuelLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          vehicleId: { in: [vehicleId, 'vehicle-2'] },
        },
        include: fuelLogListInclude,
        orderBy: [{ date: 'desc' }, { odometer: 'desc' }],
      });
    });

    it('should filter by vehicleId', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: vehicleId }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([mockFuelLog]);

      const query: ListFuelLogsQueryDto = { vehicleId };

      const result = await service.list(orgId, userId, query);

      expect(result).toHaveLength(1);
      expect(mockPrisma.fuelLog.findMany).toHaveBeenCalled();
    });

    it('should filter by driverId', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: vehicleId }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([mockFuelLog]);

      const driverId = 'driver-1';
      const query: ListFuelLogsQueryDto = { driverId };

      await service.list(orgId, userId, query);

      expect(mockPrisma.fuelLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          vehicleId: { in: [vehicleId] },
          driverId,
        },
        include: fuelLogListInclude,
        orderBy: [{ date: 'desc' }, { odometer: 'desc' }],
      });
    });

    it('should filter by date range', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: vehicleId }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([mockFuelLog]);

      const dateFrom = '2026-04-01';
      const dateTo = '2026-04-30';
      const query: ListFuelLogsQueryDto = { dateFrom, dateTo };

      await service.list(orgId, userId, query);

      const call = mockPrisma.fuelLog.findMany.mock.calls[0][0];
      expect(call.where.date.gte).toEqual(new Date(dateFrom));
      expect(call.where.date.lte).toEqual(new Date(dateTo));
    });

    it('should filter by fuelType', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: vehicleId }]);
      mockPrisma.fuelLog.findMany.mockResolvedValue([mockFuelLog]);

      const query: ListFuelLogsQueryDto = { fuelType: FuelTypeEnum.DIESEL };

      await service.list(orgId, userId, query);

      expect(mockPrisma.fuelLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          vehicleId: { in: [vehicleId] },
          fuelType: FuelTypeEnum.DIESEL,
        },
        include: fuelLogListInclude,
        orderBy: [{ date: 'desc' }, { odometer: 'desc' }],
      });
    });
  });

  describe('create', () => {
    it('should throw ForbiddenException when member not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      const dto: CreateFuelLogDto = {
        vehicleId,
        date: '2026-04-01',
        odometer: 10000,
        liters: 50,
        pricePerLiter: 6.5,
        fuelType: FuelTypeEnum.GASOLINE,
      };

      await expect(service.create(orgId, userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when vehicle not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.vehicle.findFirst.mockResolvedValue(null);

      const dto: CreateFuelLogDto = {
        vehicleId,
        date: '2026-04-01',
        odometer: 10000,
        liters: 50,
        pricePerLiter: 6.5,
        fuelType: FuelTypeEnum.GASOLINE,
      };

      await expect(service.create(orgId, userId, dto)).rejects.toThrow(
        new NotFoundException(ApiCode.VEHICLE_NOT_FOUND),
      );
    });

    it('should throw ForbiddenException when no access to customer', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        ...mockVehicle,
        customerId: 'customer-1',
      });
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue([
        'customer-2',
      ]);

      const dto: CreateFuelLogDto = {
        vehicleId,
        date: '2026-04-01',
        odometer: 10000,
        liters: 50,
        pricePerLiter: 6.5,
        fuelType: FuelTypeEnum.GASOLINE,
      };

      await expect(service.create(orgId, userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should create log with totalCost calculated correctly', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.fuelLog.findFirst.mockResolvedValue(null);
      mockPrisma.organization.findFirst.mockResolvedValue({ id: orgId });
      mockFuelPriceApiService.getLatestPrice.mockResolvedValue(null);
      mockPrisma.fuelLog.create.mockResolvedValue(mockFuelLog);

      const dto: CreateFuelLogDto = {
        vehicleId,
        date: '2026-04-01',
        odometer: 10000,
        liters: 50,
        pricePerLiter: 6.5,
        fuelType: FuelTypeEnum.GASOLINE,
      };

      const result = await service.create(orgId, userId, dto);

      expect(result.totalCost).toBe(325);
      expect(mockPrisma.fuelLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalCost: 325,
          }),
        }),
      );
    });

    it('should calculate consumption when there is a previous log', async () => {
      const previousLog = {
        id: 'log-0',
        odometer: 9500,
        date: new Date('2026-03-01'),
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.fuelLog.findFirst.mockResolvedValue(previousLog);
      mockPrisma.organization.findFirst.mockResolvedValue({ id: orgId });
      mockFuelPriceApiService.getLatestPrice.mockResolvedValue(null);
      mockPrisma.fuelLog.create.mockResolvedValue({
        ...mockFuelLog,
        consumption: 20.0,
      });

      const dto: CreateFuelLogDto = {
        vehicleId,
        date: '2026-04-01',
        odometer: 10500,
        liters: 50,
        pricePerLiter: 6.5,
        fuelType: FuelTypeEnum.GASOLINE,
      };

      const result = await service.create(orgId, userId, dto);

      expect(mockPrisma.fuelLog.create).toHaveBeenCalled();
      expect(result.consumption).toBe(20.0);
    });

    it('should set consumption to null when no previous log', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.fuelLog.findFirst.mockResolvedValue(null);
      mockPrisma.organization.findFirst.mockResolvedValue({ id: orgId });
      mockFuelPriceApiService.getLatestPrice.mockResolvedValue(null);
      mockPrisma.fuelLog.create.mockResolvedValue(mockFuelLog);

      const dto: CreateFuelLogDto = {
        vehicleId,
        date: '2026-04-01',
        odometer: 10000,
        liters: 50,
        pricePerLiter: 6.5,
        fuelType: FuelTypeEnum.GASOLINE,
      };

      const result = await service.create(orgId, userId, dto);

      expect(mockPrisma.fuelLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            consumption: null,
          }),
        }),
      );
    });

    it('should calculate consumption from vehicle initial odometer when no previous log', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.vehicle.findFirst.mockResolvedValue({
        ...mockVehicle,
        initialOdometerKm: 9000,
      });
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.fuelLog.findFirst.mockResolvedValue(null);
      mockPrisma.organization.findFirst.mockResolvedValue({ id: orgId });
      mockFuelPriceApiService.getLatestPrice.mockResolvedValue(null);
      mockPrisma.fuelLog.create.mockResolvedValue({
        ...mockFuelLog,
        consumption: 20,
      });

      const dto: CreateFuelLogDto = {
        vehicleId,
        date: '2026-04-01',
        odometer: 10000,
        liters: 50,
        pricePerLiter: 6.5,
        fuelType: FuelTypeEnum.GASOLINE,
      };

      await service.create(orgId, userId, dto);

      expect(mockPrisma.fuelLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            consumption: 20,
          }),
        }),
      );
    });

    it('should populate marketPriceRef when FuelPriceApiService returns snapshot', async () => {
      const snapshot = { avgPrice: 6.2, refDate: new Date() };

      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.fuelLog.findFirst.mockResolvedValue(null);
      mockPrisma.organization.findFirst.mockResolvedValue({ id: orgId });
      mockFuelPriceApiService.getLatestPrice.mockResolvedValue(snapshot);
      mockPrisma.fuelLog.create.mockResolvedValue({
        ...mockFuelLog,
        marketPriceRef: 6.2,
      });

      const dto: CreateFuelLogDto = {
        vehicleId,
        date: '2026-04-01',
        odometer: 10000,
        liters: 50,
        pricePerLiter: 6.5,
        fuelType: FuelTypeEnum.GASOLINE,
      };

      const result = await service.create(orgId, userId, dto);

      expect(mockPrisma.fuelLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            marketPriceRef: 6.2,
          }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('should throw ForbiddenException when member not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      await expect(service.getById('log-1', orgId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when log not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.fuelLog.findFirst.mockResolvedValue(null);

      await expect(service.getById('log-1', orgId, userId)).rejects.toThrow(
        new NotFoundException(ApiCode.FUEL_LOG_NOT_FOUND),
      );
    });

    it('should return formatted log', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.fuelLog.findFirst.mockResolvedValue(mockFuelLog);

      const result = await service.getById('log-1', orgId, userId);

      expect(result.id).toBe(mockFuelLog.id);
      expect(result.totalCost).toBe(mockFuelLog.totalCost);
      expect(result.vehicle).toEqual(mockFuelLog.vehicle);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException when member not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      const dto: UpdateFuelLogDto = {};

      await expect(
        service.update('log-1', orgId, userId, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when log not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.fuelLog.findFirst.mockResolvedValue(null);

      const dto: UpdateFuelLogDto = {};

      await expect(
        service.update('log-1', orgId, userId, dto),
      ).rejects.toThrow(new NotFoundException(ApiCode.FUEL_LOG_NOT_FOUND));
    });

    it('should update fields and recalculate totalCost and consumption', async () => {
      const currentLog = {
        ...mockFuelLog,
        vehicle: { id: vehicleId, name: 'Car', plate: 'ABC-1234', customerId: null },
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.fuelLog.findFirst
        .mockResolvedValueOnce(currentLog)
        .mockResolvedValueOnce(null);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.fuelLog.update.mockResolvedValue({
        ...mockFuelLog,
        liters: 60,
        pricePerLiter: 7.0,
        totalCost: 420,
      });

      const dto: UpdateFuelLogDto = {
        liters: 60,
        pricePerLiter: 7.0,
      };

      const result = await service.update('log-1', orgId, userId, dto);

      expect(mockPrisma.fuelLog.update).toHaveBeenCalled();
      expect(result.totalCost).toBe(420);
    });
  });

  describe('delete', () => {
    it('should throw ForbiddenException when member not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      await expect(service.delete('log-1', orgId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when log not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.fuelLog.findFirst.mockResolvedValue(null);

      await expect(service.delete('log-1', orgId, userId)).rejects.toThrow(
        new NotFoundException(ApiCode.FUEL_LOG_NOT_FOUND),
      );
    });

    it('should delete the log', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockPrisma.fuelLog.findFirst.mockResolvedValue({
        ...mockFuelLog,
        vehicle: { customerId: null },
      });
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.fuelLog.delete.mockResolvedValue(mockFuelLog);

      await service.delete('log-1', orgId, userId);

      expect(mockPrisma.fuelLog.delete).toHaveBeenCalledWith({
        where: { id: 'log-1' },
      });
    });
  });

  describe('getStats', () => {
    it('should throw ForbiddenException when member not found', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      const query: FuelStatsQueryDto = {};

      await expect(service.getStats(orgId, userId, query)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return stats with totalCost, totalLiters, count', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: vehicleId }]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([
        {
          id: 'log-1',
          totalCost: 325,
          liters: 50,
          odometer: 10000,
          date: new Date('2026-04-01'),
          consumption: null,
        },
        {
          id: 'log-2',
          totalCost: 300,
          liters: 45,
          odometer: 11000,
          date: new Date('2026-04-15'),
          consumption: 22.2,
        },
      ]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([]);

      const query: FuelStatsQueryDto = {};

      const result = await service.getStats(orgId, userId, query);

      expect(result.totalCost).toBe(625);
      expect(result.totalLiters).toBe(95);
      expect(result.count).toBe(2);
      expect(result.currentMonthCost).toBe(0);
    });

    it('should calculate avgConsumption when there are >= 2 logs with different odometer', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: vehicleId }]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([
        {
          id: 'log-1',
          totalCost: 325,
          liters: 50,
          odometer: 10000,
          date: new Date('2026-04-01'),
          consumption: null,
        },
        {
          id: 'log-2',
          totalCost: 300,
          liters: 45,
          odometer: 11000,
          date: new Date('2026-04-15'),
          consumption: 22.2,
        },
      ]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([]);

      const query: FuelStatsQueryDto = {};

      const result = await service.getStats(orgId, userId, query);

      // avgConsumption = (11000 - 10000) / 95 = 10.53
      expect(result.avgConsumption).toBe(10.53);
    });

    it('should set avgConsumption to null when insufficient data', async () => {
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: vehicleId }]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([mockFuelLog]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([]);

      const query: FuelStatsQueryDto = {};

      const result = await service.getStats(orgId, userId, query);

      expect(result.avgConsumption).toBeNull();
    });

    it('should calculate currentMonthCost correctly', async () => {
      const now = new Date();
      const currentMonthLog = {
        id: 'log-1',
        totalCost: 500,
        liters: 75,
        odometer: 10000,
        date: now,
        consumption: null,
      };

      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMember);
      mockCustomersService.getAllowedCustomerIds.mockResolvedValue(null);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: vehicleId }]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([currentMonthLog]);
      mockPrisma.fuelLog.findMany.mockResolvedValueOnce([currentMonthLog]);

      const query: FuelStatsQueryDto = {};

      const result = await service.getStats(orgId, userId, query);

      expect(result.currentMonthCost).toBe(500);
      expect(result.currentMonthCount).toBe(1);
    });
  });

  describe('getMarketPrices', () => {
    it('should return null values when state or fuelType is missing', async () => {
      const result = await service.getMarketPrices('', FuelTypeEnum.GASOLINE);

      expect(result.avgPrice).toBeNull();
      expect(result.refDate).toBeNull();
    });

    it('should return market price data when available', async () => {
      const refDate = new Date('2026-04-16');
      mockFuelPriceApiService.getLatestPrice.mockResolvedValue({
        avgPrice: 6.69,
        refDate,
      });

      const result = await service.getMarketPrices('SP', FuelTypeEnum.GASOLINE);

      expect(result.avgPrice).toBe(6.69);
      expect(result.refDate).toBe('2026-04-16');
    });

    it('should return null values on error', async () => {
      mockFuelPriceApiService.getLatestPrice.mockRejectedValue(
        new Error('API error'),
      );

      const result = await service.getMarketPrices('SP', FuelTypeEnum.GASOLINE);

      expect(result.avgPrice).toBeNull();
      expect(result.refDate).toBeNull();
    });
  });
});

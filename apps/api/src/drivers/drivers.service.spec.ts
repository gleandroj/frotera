import { BadRequestException, ConflictException } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomersService } from '@/customers/customers.service';
import { ApiCode } from '@/common/api-codes.enum';

describe('DriversService', () => {
  let service: DriversService;

  const mockPrisma = {
    driver: { findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    driverVehicleAssignment: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockCustomersService = {
    getAllowedCustomerIds: jest.fn(),
  };

  const baseDriver = { id: 'drv-1', organizationId: 'org-1', active: true };
  const baseVehicle = { id: 'veh-1', organizationId: 'org-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DriversService(
      mockPrisma as unknown as PrismaService,
      mockCustomersService as unknown as CustomersService,
    );
    mockPrisma.driver.findFirst.mockResolvedValue(baseDriver);
    mockPrisma.vehicle.findFirst.mockResolvedValue(baseVehicle);
    mockPrisma.driverVehicleAssignment.findFirst.mockResolvedValue(null);
  });

  describe('assignVehicle', () => {
    it('creates indeterminate assignment when endDate is omitted', async () => {
      mockPrisma.driverVehicleAssignment.create.mockResolvedValue({
        id: 'asg-1',
        driverId: 'drv-1',
        vehicleId: 'veh-1',
        isPrimary: false,
        startDate: new Date('2026-04-20T12:00:00.000Z'),
        endDate: null,
        vehicle: { id: 'veh-1', name: 'Truck', plate: 'ABC-1234' },
      });

      const result = await service.assignVehicle('drv-1', 'org-1', {
        vehicleId: 'veh-1',
      });

      expect(result.endDate).toBeNull();
      expect(mockPrisma.driverVehicleAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driverId: 'drv-1',
            vehicleId: 'veh-1',
            endDate: null,
            startDate: expect.any(Date),
          }),
        }),
      );
    });

    it('creates determined assignment when startDate and endDate are provided', async () => {
      const startDate = '2026-05-01T00:00:00.000Z';
      const endDate = '2026-05-10T23:59:59.999Z';
      mockPrisma.driverVehicleAssignment.create.mockResolvedValue({
        id: 'asg-2',
        driverId: 'drv-1',
        vehicleId: 'veh-1',
        isPrimary: true,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        vehicle: { id: 'veh-1', name: 'Truck', plate: 'ABC-1234' },
      });

      const result = await service.assignVehicle('drv-1', 'org-1', {
        vehicleId: 'veh-1',
        isPrimary: true,
        startDate,
        endDate,
      });

      expect(result.startDate).toBe(startDate);
      expect(result.endDate).toBe(endDate);
      expect(mockPrisma.driverVehicleAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isPrimary: true,
          }),
        }),
      );
    });

    it('rejects invalid period when endDate is not greater than startDate', async () => {
      await expect(
        service.assignVehicle('drv-1', 'org-1', {
          vehicleId: 'veh-1',
          startDate: '2026-05-10T00:00:00.000Z',
          endDate: '2026-05-10T00:00:00.000Z',
        }),
      ).rejects.toEqual(new BadRequestException(ApiCode.DRIVER_ASSIGNMENT_INVALID_PERIOD));
    });

    it('rejects overlapping assignment for same driver and vehicle', async () => {
      mockPrisma.driverVehicleAssignment.findFirst.mockResolvedValueOnce({
        id: 'asg-existing',
      });

      await expect(
        service.assignVehicle('drv-1', 'org-1', {
          vehicleId: 'veh-1',
          startDate: '2026-05-01T00:00:00.000Z',
          endDate: '2026-05-03T00:00:00.000Z',
        }),
      ).rejects.toEqual(new ConflictException(ApiCode.DRIVER_ASSIGNMENT_OVERLAP));
    });
  });
});

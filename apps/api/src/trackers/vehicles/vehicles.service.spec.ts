import { BadRequestException } from "@nestjs/common";
import { ApiCode } from "@/common/api-codes.enum";
import { PrismaService } from "@/prisma/prisma.service";
import { CustomersService } from "@/customers/customers.service";
import { TrackerDevicesService } from "../devices/tracker-devices.service";
import { VehiclesService } from "./vehicles.service";

describe("VehiclesService", () => {
  const makeVehicle = (overrides: Record<string, unknown> = {}) => ({
    id: "veh-1",
    organizationId: "org-1",
    name: "Truck",
    plate: "ABC-1234",
    serial: null,
    color: null,
    year: null,
    renavam: null,
    chassis: null,
    vehicleType: null,
    vehicleSpecies: null,
    vehicleBodyType: null,
    vehicleTraction: null,
    vehicleUseCategory: null,
    inactive: false,
    speedLimit: null,
    initialOdometerKm: null,
    notes: null,
    trackerDeviceId: null,
    customerId: "cust-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    trackerDevice: null,
    customer: { id: "cust-1", name: "Customer 1" },
    ...overrides,
  });

  const mockPrisma = {
    vehicle: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    trackerDevice: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCustomersService = {
    getCustomerIdAndAncestorIds: jest.fn(),
    getDescendantCustomerIds: jest.fn(),
  };

  let service: VehiclesService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new VehiclesService(
      mockPrisma as unknown as PrismaService,
      {} as TrackerDevicesService,
      mockCustomersService as unknown as CustomersService,
    );

    mockPrisma.vehicle.findFirst.mockResolvedValue({
      customerId: "cust-1",
      plate: "ABC-1234",
    });
    mockCustomersService.getCustomerIdAndAncestorIds.mockResolvedValue(["cust-1"]);
    mockCustomersService.getDescendantCustomerIds.mockResolvedValue([]);
    mockPrisma.vehicle.findMany.mockResolvedValue([]);
    mockPrisma.vehicle.findUnique.mockResolvedValue(makeVehicle());
    mockPrisma.vehicle.update.mockResolvedValue({ id: "veh-1" });
  });

  it("remove o rastreador ao receber trackerDeviceId nulo", async () => {
    await service.update(
      "org-1",
      "veh-1",
      { trackerDeviceId: null },
      null,
      null,
    );

    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: "veh-1" },
      data: { trackerDeviceId: null },
    });
  });

  it("move rastreador de outro veículo em transação", async () => {
    const tx = {
      vehicle: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: "veh-1" }),
      },
    };
    mockPrisma.trackerDevice.findFirst.mockResolvedValue({ id: "dev-1" });
    mockPrisma.$transaction.mockImplementation(async (cb: (trx: typeof tx) => Promise<unknown>) =>
      cb(tx),
    );

    await service.update(
      "org-1",
      "veh-1",
      { trackerDeviceId: "dev-1" },
      null,
      null,
    );

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.vehicle.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", trackerDeviceId: "dev-1", id: { not: "veh-1" } },
      data: { trackerDeviceId: null },
    });
    expect(tx.vehicle.update).toHaveBeenCalledWith({
      where: { id: "veh-1" },
      data: { trackerDeviceId: "dev-1" },
    });
  });

  it("falha ao vincular rastreador inexistente ou de outra organização", async () => {
    mockPrisma.trackerDevice.findFirst.mockResolvedValue(null);

    await expect(
      service.update(
        "org-1",
        "veh-1",
        { trackerDeviceId: "dev-404" },
        null,
        null,
      ),
    ).rejects.toEqual(new BadRequestException(ApiCode.ORGANIZATION_NOT_FOUND));
  });
});

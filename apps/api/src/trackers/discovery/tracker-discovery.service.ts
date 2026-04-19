import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TrackerModel } from "@prisma/client";
import { ApiCode } from "@/common/api-codes.enum";
import { PrismaService } from "@/prisma/prisma.service";

@Injectable()
export class TrackerDiscoveryService {
  private readonly logger = new Logger(TrackerDiscoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordUnknownLogin(imei: string, remoteAddress?: string | null): Promise<void> {
    const now = new Date();
    const addr =
      remoteAddress && remoteAddress.length > 255
        ? remoteAddress.slice(0, 255)
        : remoteAddress ?? null;

    await this.prisma.trackerDiscoveryLogin.upsert({
      where: { imei },
      create: {
        imei,
        protocol: "GT06",
        firstSeenAt: now,
        lastSeenAt: now,
        loginCount: 1,
        lastRemoteAddress: addr,
      },
      update: {
        lastSeenAt: now,
        loginCount: { increment: 1 },
        lastRemoteAddress: addr,
      },
    });
  }

  async listRecent(): Promise<
    {
      id: string;
      imei: string;
      protocol: string | null;
      firstSeenAt: Date;
      lastSeenAt: Date;
      loginCount: number;
      lastRemoteAddress: string | null;
    }[]
  > {
    return this.prisma.trackerDiscoveryLogin.findMany({
      orderBy: { lastSeenAt: "desc" },
    });
  }

  async listAllOrganizations(): Promise<{ id: string; name: string }[]> {
    return this.prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  async listVehiclesWithoutTracker(organizationId: string): Promise<
    {
      id: string;
      plate: string | null;
      name: string | null;
      customer: { id: string; name: string };
    }[]
  > {
    return this.prisma.vehicle.findMany({
      where: {
        organizationId,
        trackerDeviceId: null,
      },
      select: {
        id: true,
        plate: true,
        name: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ plate: "asc" }, { name: "asc" }],
    });
  }

  async registerToVehicle(
    imei: string,
    vehicleId: string,
    model: TrackerModel = TrackerModel.X12_GT06,
  ): Promise<{ deviceId: string; vehicleId: string; organizationId: string }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const discovery = await tx.trackerDiscoveryLogin.findUnique({
          where: { imei },
        });
        if (!discovery) {
          throw new NotFoundException(ApiCode.TRACKER_DISCOVERY_NOT_FOUND);
        }

        const existingDevice = await tx.trackerDevice.findUnique({
          where: { imei },
        });
        if (existingDevice) {
          throw new ConflictException(ApiCode.TRACKER_DISCOVERY_IMEI_ALREADY_REGISTERED);
        }

        const vehicle = await tx.vehicle.findUnique({
          where: { id: vehicleId },
        });
        if (!vehicle) {
          throw new NotFoundException(ApiCode.VEHICLE_NOT_FOUND);
        }

        if (vehicle.trackerDeviceId != null) {
          throw new BadRequestException(
            ApiCode.TRACKER_DISCOVERY_VEHICLE_ALREADY_HAS_DEVICE,
          );
        }

        const device = await tx.trackerDevice.create({
          data: {
            organizationId: vehicle.organizationId,
            imei,
            model,
          },
        });

        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { trackerDeviceId: device.id },
        });

        await tx.trackerDiscoveryLogin.delete({ where: { imei } });

        return {
          deviceId: device.id,
          vehicleId: vehicle.id,
          organizationId: vehicle.organizationId,
        };
      });
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof ConflictException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(ApiCode.TRACKER_DISCOVERY_IMEI_ALREADY_REGISTERED);
      }
      this.logger.warn(`registerToVehicle failed: ${(err as Error).message}`);
      throw err;
    }
  }
}

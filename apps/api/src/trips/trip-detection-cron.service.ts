import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { TripDetectorService } from './trip-detector.service';
import { TRACKER_REDIS } from '@/trackers/ingress/tracker-redis-writer.service';
import type { RedisClientType } from 'redis';

@Injectable()
export class TripDetectionCronService {
  private readonly logger = new Logger(TripDetectionCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly detector: TripDetectorService,
    @Inject(TRACKER_REDIS) private readonly redis: RedisClientType,
  ) {}

  @Cron('0 */10 * * * *')
  async detectTrips(): Promise<void> {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Find vehicles with active tracker devices (connected in last 2 hours or recently)
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        trackerDevice: {
          connectedAt: { gte: twoHoursAgo },
        },
      },
      select: {
        id: true,
        organizationId: true,
        trackerDeviceId: true,
      },
    });

    for (const vehicle of vehicles) {
      if (!vehicle.trackerDeviceId) continue;
      try {
        const lastProcessedKey = `trip:lastProcessed:${vehicle.trackerDeviceId}`;
        const lastProcessed = await this.redis.get(lastProcessedKey);
        const from = lastProcessed ? new Date(lastProcessed) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const to = new Date();

        if (to.getTime() - from.getTime() < 60000) continue; // Skip if < 1 minute

        await this.detector.detectTripsForVehicle(vehicle.organizationId, vehicle.id, from, to);
      } catch (err) {
        this.logger.error(`Failed trip detection for vehicle ${vehicle.id}`, err);
      }
    }
  }
}

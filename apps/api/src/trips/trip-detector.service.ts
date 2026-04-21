import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GeocodingService } from '@/geocoding/geocoding.service';
import { haversineDistance } from '@/telemetry/geofence.utils';
import { TRACKER_REDIS } from '@/trackers/ingress/tracker-redis-writer.service';
import type { RedisClientType } from 'redis';

const MIN_TRIP_DURATION_SEC = 60;
const MIN_TRIP_DISTANCE_M = 100;
const MIN_STOP_DURATION_SEC = 300;
const SPEED_THRESHOLD_KMH = 1.0;

@Injectable()
export class TripDetectorService {
  private readonly logger = new Logger(TripDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
    @Inject(TRACKER_REDIS) private readonly redis: RedisClientType,
  ) {}

  async detectTripsForVehicle(
    organizationId: string,
    vehicleId: string,
    from: Date,
    to: Date,
  ): Promise<void> {
    // Find the tracker device for this vehicle
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { trackerDeviceId: true },
    });
    if (!vehicle?.trackerDeviceId) return;

    const deviceId = vehicle.trackerDeviceId;

    // Fetch positions in range, ordered by time
    const positions = await this.prisma.devicePosition.findMany({
      where: {
        deviceId,
        recordedAt: { gte: from, lte: to },
      },
      orderBy: { recordedAt: 'asc' },
    });

    if (positions.length < 2) return;

    // Delete existing trips/stops for this vehicle in the range (re-process)
    await this.prisma.vehicleStop.deleteMany({
      where: { vehicleId, startedAt: { gte: from, lte: to } },
    });
    await this.prisma.vehicleTrip.deleteMany({
      where: { vehicleId, startedAt: { gte: from, lte: to } },
    });

    // Find the active driver assignment at start of range
    const driverAssignment = await this.prisma.driverVehicleAssignment.findFirst({
      where: {
        vehicleId,
        startDate: { lte: from },
        OR: [{ endDate: null }, { endDate: { gte: from } }],
        isPrimary: true,
      },
      orderBy: { startDate: 'desc' },
    });
    const driverId = driverAssignment?.driverId ?? null;

    // State machine for trip detection
    type State = 'STOPPED' | 'IN_TRIP';
    let state: State = 'STOPPED';

    let tripStartIdx = 0;
    let stopStartIdx = 0;
    let lastMovingIdx = 0;

    const trips: Array<{
      startIdx: number;
      endIdx: number;
      idleSeconds: number;
    }> = [];

    const isMoving = (pos: typeof positions[0]): boolean => {
      if (pos.ignitionOn !== null && pos.ignitionOn !== undefined) {
        return pos.ignitionOn;
      }
      return (pos.speed ?? 0) > SPEED_THRESHOLD_KMH;
    };

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const moving = isMoving(pos);

      if (state === 'STOPPED') {
        if (moving) {
          state = 'IN_TRIP';
          tripStartIdx = i;
          lastMovingIdx = i;
        }
      } else {
        // IN_TRIP
        if (moving) {
          lastMovingIdx = i;
        } else {
          // Check if stop duration is long enough to end the trip
          const stopDuration =
            (pos.recordedAt.getTime() - positions[lastMovingIdx].recordedAt.getTime()) / 1000;
          if (stopDuration >= MIN_STOP_DURATION_SEC) {
            // End the trip at lastMovingIdx
            trips.push({ startIdx: tripStartIdx, endIdx: lastMovingIdx, idleSeconds: 0 });
            state = 'STOPPED';
            stopStartIdx = lastMovingIdx + 1;
          }
        }
      }
    }

    // Close any open trip
    if (state === 'IN_TRIP') {
      trips.push({ startIdx: tripStartIdx, endIdx: lastMovingIdx, idleSeconds: 0 });
    }

    // Process each trip
    for (const { startIdx, endIdx } of trips) {
      const startPos = positions[startIdx];
      const endPos = positions[endIdx];

      // Calculate duration
      const durationSeconds = Math.round(
        (endPos.recordedAt.getTime() - startPos.recordedAt.getTime()) / 1000,
      );
      if (durationSeconds < MIN_TRIP_DURATION_SEC) continue;

      // Calculate distance, speed stats, and ignition-on seconds
      let distanceMeters = 0;
      let maxSpeed = 0;
      let totalSpeed = 0;
      let speedCount = 0;
      let ignitionOnSeconds = 0;
      for (let i = startIdx + 1; i <= endIdx; i++) {
        const a = positions[i - 1];
        const b = positions[i];
        distanceMeters += haversineDistance(
          [a.latitude, a.longitude],
          [b.latitude, b.longitude],
        );
        const spd = b.speed ?? 0;
        if (spd > maxSpeed) maxSpeed = spd;
        if (spd > 0) {
          totalSpeed += spd;
          speedCount++;
        }
        if (b.ignitionOn === true) {
          const intervalSec = (b.recordedAt.getTime() - a.recordedAt.getTime()) / 1000;
          ignitionOnSeconds += Math.round(intervalSec);
        }
      }

      if (distanceMeters < MIN_TRIP_DISTANCE_M) continue;

      const avgSpeedKmh = speedCount > 0 ? totalSpeed / speedCount : null;

      // Geocode start/end (fire and don't block on error)
      const [startAddress, endAddress] = await Promise.all([
        this.geocoding.reverseGeocode(startPos.latitude, startPos.longitude),
        this.geocoding.reverseGeocode(endPos.latitude, endPos.longitude),
      ]);

      await this.prisma.vehicleTrip.create({
        data: {
          organizationId,
          vehicleId,
          deviceId,
          driverId,
          startedAt: startPos.recordedAt,
          endedAt: endPos.recordedAt,
          startLat: startPos.latitude,
          startLng: startPos.longitude,
          endLat: endPos.latitude,
          endLng: endPos.longitude,
          startAddress,
          endAddress,
          distanceMeters: Math.round(distanceMeters),
          maxSpeedKmh: maxSpeed > 0 ? maxSpeed : null,
          avgSpeedKmh,
          durationSeconds,
          ignitionOnSeconds: ignitionOnSeconds > 0 ? ignitionOnSeconds : null,
          pointCount: endIdx - startIdx + 1,
        },
      });
    }

    // Update last processed marker in Redis
    await this.redis.setEx(`trip:lastProcessed:${deviceId}`, 86400 * 7, to.toISOString());

    this.logger.log(`Processed trips for vehicle ${vehicleId}: ${trips.length} trips found`);
  }
}

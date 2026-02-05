import { Injectable, Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RedisClientType } from "redis";
import { NormalizedPosition } from "../dto/index";

export const TRACKER_REDIS = "TRACKER_REDIS";

@Injectable()
export class TrackerRedisWriterService {
  private readonly logger = new Logger(TrackerRedisWriterService.name);
  private readonly streamKey: string;
  private readonly lastPrefix: string;

  constructor(
    @Inject(TRACKER_REDIS) private readonly redis: RedisClientType,
    private readonly config: ConfigService,
  ) {
    this.streamKey =
      this.config.get<string>("TRACKER_REDIS_STREAM_KEY") ?? "tracker:positions";
    this.lastPrefix =
      this.config.get<string>("TRACKER_REDIS_LAST_PREFIX") ?? "tracker:last:";
  }

  /**
   * Push a position to the Redis stream and update last position for the device.
   * Called by TCP service for each position packet (no direct Postgres write).
   */
  async pushPosition(
    deviceId: string,
    imei: string,
    position: NormalizedPosition,
  ): Promise<void> {
    const lastKey = `${this.lastPrefix}${deviceId}`;
    const lat = String(position.latitude);
    const lng = String(position.longitude);
    const alt = position.altitude != null ? String(position.altitude) : "";
    const spd = position.speed != null ? String(position.speed) : "";
    const hdg = position.heading != null ? String(position.heading) : "";
    const rec = position.recordedAt;
    const alarm =
      position.alarmFlags != null ? String(position.alarmFlags) : "";

    await this.redis.sendCommand([
      "XADD",
      this.streamKey,
      "*",
      "deviceId",
      deviceId,
      "imei",
      imei,
      "latitude",
      lat,
      "longitude",
      lng,
      "altitude",
      alt,
      "speed",
      spd,
      "heading",
      hdg,
      "recordedAt",
      rec,
      "alarmFlags",
      alarm,
    ]);

    await this.redis.hSet(lastKey, {
      latitude: lat,
      longitude: lng,
      altitude: alt,
      speed: spd,
      heading: hdg,
      recordedAt: rec,
      deviceId,
      imei,
    });

    this.logger.debug(`Pushed position for device ${deviceId}`);
  }

  /**
   * Get last position from Redis (for API). Returns null if not in Redis.
   */
  async getLastPosition(deviceId: string): Promise<NormalizedPosition | null> {
    const lastKey = `${this.lastPrefix}${deviceId}`;
    const data = await this.redis.hGetAll(lastKey);
    if (!data || !data.latitude) return null;
    return {
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      altitude: data.altitude ? parseFloat(data.altitude) : undefined,
      speed: data.speed ? parseFloat(data.speed) : undefined,
      heading: data.heading ? parseFloat(data.heading) : undefined,
      recordedAt: data.recordedAt ?? new Date().toISOString(),
    };
  }
}

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
    const rcv = new Date().toISOString();
    const alarm = position.alarmFlags != null ? String(position.alarmFlags) : "";
    const ign = position.ignitionOn != null ? String(position.ignitionOn) : "";
    const volt = position.voltageLevel != null ? String(position.voltageLevel) : "";
    const gsm = position.gsmSignal != null ? String(position.gsmSignal) : "";
    const alarmCode = position.alarmCode != null ? String(position.alarmCode) : "";
    const chrg = position.chargeOn != null ? String(position.chargeOn) : "";
    const pcut = position.powerCut != null ? String(position.powerCut) : "";
    const mcc = position.lbsMcc != null ? String(position.lbsMcc) : "";
    const mnc = position.lbsMnc != null ? String(position.lbsMnc) : "";
    const lac = position.lbsLac != null ? String(position.lbsLac) : "";
    const cell = position.lbsCellId != null ? String(position.lbsCellId) : "";

    await this.redis.sendCommand([
      "XADD", this.streamKey, "*",
      "deviceId", deviceId,
      "imei", imei,
      "latitude", lat,
      "longitude", lng,
      "altitude", alt,
      "speed", spd,
      "heading", hdg,
      "recordedAt", rec,
      "receivedAt", rcv,
      "alarmFlags", alarm,
      "ignitionOn", ign,
      "voltageLevel", volt,
      "gsmSignal", gsm,
      "alarmCode", alarmCode,
      "chargeOn", chrg,
      "powerCut", pcut,
      "lbsMcc", mcc,
      "lbsMnc", mnc,
      "lbsLac", lac,
      "lbsCellId", cell,
    ]);

    await this.redis.hSet(lastKey, {
      latitude: lat,
      longitude: lng,
      altitude: alt,
      speed: spd,
      heading: hdg,
      recordedAt: rec,
      receivedAt: rcv,
      deviceId,
      imei,
    });

    const pubChannel = `tracker:position:${deviceId}`;
    const payload = JSON.stringify({
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude ?? null,
      speed: position.speed ?? null,
      heading: position.heading ?? null,
      recordedAt: position.recordedAt,
    });
    await this.redis.publish(pubChannel, payload);

    this.logger.debug(`Pushed position for device ${deviceId}`);
  }

  /**
   * Push a status-only event (heartbeat without GPS) to a dedicated Redis key.
   * Does not write to the position stream (no lat/lng available).
   */
  async pushStatusOnly(
    deviceId: string,
    status: {
      accOn?: boolean;
      chargeOn?: boolean;
      powerCut?: boolean;
      alarmCode?: number;
      voltageLevel?: number;
      gsmSignal?: number;
    },
  ): Promise<void> {
    const key = `tracker:status:${deviceId}`;
    await this.redis.hSet(key, {
      ignitionOn: status.accOn != null ? String(status.accOn) : "",
      chargeOn: status.chargeOn != null ? String(status.chargeOn) : "",
      powerCut: status.powerCut != null ? String(status.powerCut) : "",
      alarmCode: status.alarmCode != null ? String(status.alarmCode) : "",
      voltageLevel: status.voltageLevel != null ? String(status.voltageLevel) : "",
      gsmSignal: status.gsmSignal != null ? String(status.gsmSignal) : "",
      updatedAt: new Date().toISOString(),
    });
    this.logger.debug(`Pushed status-only for device ${deviceId}`);
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
      receivedAt: data.receivedAt || undefined,
    };
  }
}

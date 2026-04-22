import { Injectable, Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RedisClientType } from "redis";
import { NormalizedPosition } from "../dto/index";
import { GeocodingService } from "@/geocoding/geocoding.service";
import { TRACKER_REDIS } from "./tracker-redis.tokens";

export { TRACKER_REDIS };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class TrackerRedisWriterService {
  private readonly logger = new Logger(TrackerRedisWriterService.name);
  private readonly streamKey: string;
  private readonly lastPrefix: string;

  constructor(
    @Inject(TRACKER_REDIS) private readonly redis: RedisClientType,
    private readonly config: ConfigService,
    private readonly geocoding: GeocodingService,
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

    // Odometer: prefer device-reported value; fall back to GPS-accumulated Haversine
    const lastHash = await this.redis.hGetAll(lastKey);
    let odometerKm = 0;
    if (position.deviceOdometerKm != null && position.deviceOdometerKm > 0) {
      odometerKm = position.deviceOdometerKm;
      this.logger.debug(
        `[odo] device odometer: ${odometerKm.toFixed(3)} km (IMEI=${imei})`,
      );
    } else if (lastHash.latitude && lastHash.longitude) {
      const delta = haversineKm(
        parseFloat(lastHash.latitude), parseFloat(lastHash.longitude),
        position.latitude, position.longitude,
      );
      odometerKm = parseFloat(lastHash.odometerKm || '0') + delta;
    } else if (lastHash.odometerKm) {
      odometerKm = parseFloat(lastHash.odometerKm);
    }
    const odo = String(odometerKm);

    // City: use cached geocode from Redis (fire-and-forget update if missing)
    let city = lastHash.latitude === lat && lastHash.longitude === lng
      ? (lastHash.city || '')
      : '';
    const geoKey = `geocode:reverse:${Math.round(position.latitude * 10000) / 10000}:${Math.round(position.longitude * 10000) / 10000}`;
    const cachedCity = await this.redis.get(geoKey);
    if (cachedCity !== null && cachedCity !== '') {
      city = cachedCity;
    } else if (cachedCity === null) {
      // Trigger geocoding async without blocking
      this.geocoding.reverseGeocode(position.latitude, position.longitude)
        .then((result) => {
          if (result) this.redis.hSet(lastKey, 'city', result);
        })
        .catch(() => {});
    }

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
      "odometerKm", odo,
      "city", city,
    ]);

    await this.redis.hSet(lastKey, {
      latitude: lat,
      longitude: lng,
      altitude: alt,
      speed: spd,
      heading: hdg,
      recordedAt: rec,
      receivedAt: rcv,
      ignitionOn: ign,
      voltageLevel: volt,
      odometerKm: odo,
      city,
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
      receivedAt: rcv,
      ignitionOn: position.ignitionOn ?? null,
      voltageLevel: position.voltageLevel ?? null,
      odometerKm,
      city: city || null,
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
      ignitionOn: data.ignitionOn === 'true' ? true : data.ignitionOn === 'false' ? false : undefined,
      voltageLevel: data.voltageLevel ? parseInt(data.voltageLevel, 10) : undefined,
      odometerKm: data.odometerKm ? parseFloat(data.odometerKm) : undefined,
      city: data.city || undefined,
    };
  }
}

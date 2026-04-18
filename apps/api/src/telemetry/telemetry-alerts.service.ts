import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import {
  AlertSeverity,
  AlertType,
  GeofenceType,
} from "@prisma/client";
import type { RedisClientType } from "redis";
import { PrismaService } from "@/prisma/prisma.service";
import type { NormalizedPosition } from "@/trackers/dto/index";
import { TRACKER_REDIS } from "@/trackers/ingress/tracker-redis-writer.service";
import { TrackerRedisWriterService } from "@/trackers/ingress/tracker-redis-writer.service";
import { isPointInZone } from "./geofence.utils";
import {
  ALERT_DEDUP_PREFIX,
  DEVICE_OFFLINE_DEDUP_MULT,
  GEOFENCE_ORG_CACHE_PREFIX,
  GEOFENCE_ORG_CACHE_TTL_SEC,
  GEOFENCE_STATE_HASH_PREFIX,
  SPEEDING_DEDUP_SEC,
  TELEMETRY_ALERT_CHANNEL,
} from "./telemetry-alerts.constants";

type AlertWire = Record<string, unknown>;

@Injectable()
export class TelemetryAlertsService {
  private readonly logger = new Logger(TelemetryAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TRACKER_REDIS) private readonly redis: RedisClientType,
    private readonly redisWriter: TrackerRedisWriterService,
    private readonly config: ConfigService,
  ) {}

  async processPosition(params: {
    deviceId: string;
    organizationId: string;
    vehicleId: string | null;
    position: NormalizedPosition;
    prevIgnitionOn?: boolean | null;
    currentIgnitionOn?: boolean | null;
  }): Promise<void> {
    try {
      await this.runProcessPosition(params);
    } catch (e) {
      this.logger.warn(
        `Alert processing failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async runProcessPosition(params: {
    deviceId: string;
    organizationId: string;
    vehicleId: string | null;
    position: NormalizedPosition;
    prevIgnitionOn?: boolean | null;
    currentIgnitionOn?: boolean | null;
  }): Promise<void> {
    const {
      deviceId,
      organizationId,
      vehicleId,
      position,
      prevIgnitionOn,
      currentIgnitionOn,
    } = params;
    if (
      typeof position.latitude !== "number" ||
      typeof position.longitude !== "number"
    ) {
      return;
    }
    const point: [number, number] = [position.latitude, position.longitude];

    await this.checkSpeeding({
      deviceId,
      organizationId,
      vehicleId,
      position,
    });

    await this.checkIgnition({
      deviceId,
      organizationId,
      vehicleId,
      position,
      prevIgnitionOn,
      currentIgnitionOn,
    });

    await this.checkGeofences({
      deviceId,
      organizationId,
      vehicleId,
      point,
    });
  }

  private async checkSpeeding(ctx: {
    deviceId: string;
    organizationId: string;
    vehicleId: string | null;
    position: NormalizedPosition;
  }): Promise<void> {
    const { deviceId, organizationId, vehicleId, position } = ctx;
    if (vehicleId == null || position.speed == null) return;

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
      select: { speedLimit: true },
    });
    const limit = vehicle?.speedLimit;
    if (limit == null || limit <= 0) return;
    if (position.speed <= limit) return;

    const dedupKey = `${ALERT_DEDUP_PREFIX}${deviceId}:${AlertType.SPEEDING}`;
    const setOk = await this.redis.set(dedupKey, "1", {
      NX: true,
      EX: SPEEDING_DEDUP_SEC,
    });
    if (setOk === null) return;

    await this.persistAndPublish({
      organizationId,
      vehicleId,
      deviceId,
      type: AlertType.SPEEDING,
      severity: AlertSeverity.WARNING,
      message: `Velocidade ${position.speed.toFixed(0)} km/h acima do limite de ${limit.toFixed(0)} km/h`,
      metadata: {
        speed: position.speed,
        speedLimit: limit,
        latitude: position.latitude,
        longitude: position.longitude,
      },
    });
  }

  private async checkIgnition(ctx: {
    deviceId: string;
    organizationId: string;
    vehicleId: string | null;
    position: NormalizedPosition;
    prevIgnitionOn?: boolean | null;
    currentIgnitionOn?: boolean | null;
  }): Promise<void> {
    const {
      deviceId,
      organizationId,
      vehicleId,
      position,
      prevIgnitionOn,
      currentIgnitionOn,
    } = ctx;
    if (
      prevIgnitionOn === null ||
      prevIgnitionOn === undefined ||
      currentIgnitionOn === null ||
      currentIgnitionOn === undefined
    ) {
      return;
    }
    if (prevIgnitionOn === currentIgnitionOn) return;

    const type = currentIgnitionOn
      ? AlertType.IGNITION_ON
      : AlertType.IGNITION_OFF;
    await this.persistAndPublish({
      organizationId,
      vehicleId,
      deviceId,
      type,
      severity: AlertSeverity.INFO,
      message: currentIgnitionOn ? "Ignição ligada" : "Ignição desligada",
      metadata: {
        latitude: position.latitude,
        longitude: position.longitude,
      },
    });
  }

  private async checkGeofences(ctx: {
    deviceId: string;
    organizationId: string;
    vehicleId: string | null;
    point: [number, number];
  }): Promise<void> {
    const { deviceId, organizationId, vehicleId, point } = ctx;
    const zones = await this.loadActiveGeofences(organizationId);
    if (zones.length === 0) return;

    const hashKey = `${GEOFENCE_STATE_HASH_PREFIX}${deviceId}`;

    for (const zone of zones) {
      const applies =
        zone.vehicleIds.length === 0 ||
        (vehicleId != null && zone.vehicleIds.includes(vehicleId));
      if (!applies) continue;

      const inside = isPointInZone(point, {
        type: zone.type as GeofenceType,
        coordinates: zone.coordinates,
      });

      const prev = await this.redis.hGet(hashKey, zone.id);
      const nextLabel = inside ? "in" : "out";

      if (prev === null || prev === undefined) {
        await this.redis.hSet(hashKey, zone.id, nextLabel);
        continue;
      }

      if (prev === "in" && !inside && zone.alertOnExit) {
        await this.persistAndPublish({
          organizationId,
          vehicleId,
          deviceId,
          type: AlertType.GEOFENCE_EXIT,
          severity: AlertSeverity.INFO,
          message: `Saída da zona "${zone.name}"`,
          metadata: {
            latitude: point[0],
            longitude: point[1],
            geofenceId: zone.id,
            geofenceName: zone.name,
          },
        });
      } else if (prev === "out" && inside && zone.alertOnEnter) {
        await this.persistAndPublish({
          organizationId,
          vehicleId,
          deviceId,
          type: AlertType.GEOFENCE_ENTER,
          severity: AlertSeverity.WARNING,
          message: `Entrada na zona "${zone.name}"`,
          metadata: {
            latitude: point[0],
            longitude: point[1],
            geofenceId: zone.id,
            geofenceName: zone.name,
          },
        });
      }

      await this.redis.hSet(hashKey, zone.id, nextLabel);
    }
  }

  private async loadActiveGeofences(
    organizationId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      type: GeofenceType;
      coordinates: Prisma.JsonValue;
      vehicleIds: string[];
      alertOnEnter: boolean;
      alertOnExit: boolean;
    }>
  > {
    const cacheKey = `${GEOFENCE_ORG_CACHE_PREFIX}${organizationId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as Array<{
          id: string;
          name: string;
          type: GeofenceType;
          coordinates: Prisma.JsonValue;
          vehicleIds: string[];
          alertOnEnter: boolean;
          alertOnExit: boolean;
        }>;
      } catch {
        /* fall through */
      }
    }
    const rows = await this.prisma.geofenceZone.findMany({
      where: { organizationId, active: true },
      select: {
        id: true,
        name: true,
        type: true,
        coordinates: true,
        vehicleIds: true,
        alertOnEnter: true,
        alertOnExit: true,
      },
    });
    await this.redis.setEx(
      cacheKey,
      GEOFENCE_ORG_CACHE_TTL_SEC,
      JSON.stringify(rows),
    );
    return rows;
  }

  private rowToWire(
    row: Prisma.TelemetryAlertGetPayload<{
      include: {
        vehicle: { select: { id: true; name: true; plate: true } };
        device: { select: { id: true; imei: true; name: true } };
      };
    }>,
  ): AlertWire {
    return {
      id: row.id,
      organizationId: row.organizationId,
      vehicleId: row.vehicleId,
      deviceId: row.deviceId,
      type: row.type,
      severity: row.severity,
      message: row.message,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: row.acknowledgedBy,
      createdAt: row.createdAt.toISOString(),
      vehicle: row.vehicle,
      device: row.device,
    };
  }

  private async persistAndPublish(data: {
    organizationId: string;
    vehicleId: string | null;
    deviceId: string;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    metadata?: Record<string, unknown>;
    dedupTtlSec?: number;
  }): Promise<void> {
    if (data.type === AlertType.DEVICE_OFFLINE) {
      const existing = await this.prisma.telemetryAlert.findFirst({
        where: {
          deviceId: data.deviceId,
          type: AlertType.DEVICE_OFFLINE,
          acknowledgedAt: null,
        },
        select: { id: true },
      });
      if (existing) return;
    }

    if (data.dedupTtlSec != null && data.dedupTtlSec > 0) {
      const dedupKey = `${ALERT_DEDUP_PREFIX}${data.deviceId}:${data.type}`;
      const setOk = await this.redis.set(dedupKey, "1", {
        NX: true,
        EX: data.dedupTtlSec,
      });
      if (setOk === null) return;
    }

    const row = await this.prisma.telemetryAlert.create({
      data: {
        organizationId: data.organizationId,
        vehicleId: data.vehicleId,
        deviceId: data.deviceId,
        type: data.type,
        severity: data.severity,
        message: data.message,
        metadata:
          data.metadata != null
            ? (data.metadata as Prisma.InputJsonValue)
            : undefined,
      },
      include: {
        vehicle: { select: { id: true, name: true, plate: true } },
        device: { select: { id: true, imei: true, name: true } },
      },
    });

    const wire = this.rowToWire(
      row as Prisma.TelemetryAlertGetPayload<{
        include: {
          vehicle: { select: { id: true; name: true; plate: true } };
          device: { select: { id: true; imei: true; name: true } };
        };
      }>,
    );
    await this.redis.publish(
      TELEMETRY_ALERT_CHANNEL,
      JSON.stringify({ organizationId: data.organizationId, alert: wire }),
    );
  }

  /** Cron: create DEVICE_OFFLINE when last position is older than threshold. */
  async tryCreateDeviceOfflineAlert(device: {
    id: string;
    organizationId: string;
    vehicleId: string | null;
  }): Promise<void> {
    try {
      await this.runOfflineCheck(device);
    } catch (e) {
      this.logger.warn(
        `Offline alert check failed for ${device.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async runOfflineCheck(device: {
    id: string;
    organizationId: string;
    vehicleId: string | null;
  }): Promise<void> {
    const thresholdMin = parseInt(
      this.config.get<string>("DEVICE_OFFLINE_THRESHOLD_MINUTES") ?? "15",
      10,
    );
    const thresholdMs = Math.max(1, thresholdMin) * 60 * 1000;
    const now = Date.now();

    let recordedAtMs: number | null = null;
    const last = await this.redisWriter.getLastPosition(device.id);
    if (last?.recordedAt) {
      recordedAtMs = new Date(last.recordedAt).getTime();
    } else {
      const lastDb = await this.prisma.devicePosition.findFirst({
        where: { deviceId: device.id },
        orderBy: { recordedAt: "desc" },
        select: { recordedAt: true },
      });
      if (lastDb) recordedAtMs = lastDb.recordedAt.getTime();
    }

    if (recordedAtMs != null && now - recordedAtMs < thresholdMs) {
      return;
    }

    const dedupSec = thresholdMin * 60 * DEVICE_OFFLINE_DEDUP_MULT;

    await this.persistAndPublish({
      organizationId: device.organizationId,
      vehicleId: device.vehicleId,
      deviceId: device.id,
      type: AlertType.DEVICE_OFFLINE,
      severity: AlertSeverity.CRITICAL,
      message: `Dispositivo sem posição há mais de ${thresholdMin} minutos`,
      metadata: {
        thresholdMinutes: thresholdMin,
        lastRecordedAt:
          recordedAtMs != null
            ? new Date(recordedAtMs).toISOString()
            : null,
      },
      dedupTtlSec: dedupSec,
    });
  }
}

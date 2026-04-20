import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import {
  AlertSeverity,
  AlertType,
  GeofenceType,
} from "@prisma/client";
import type { RedisClientType } from "redis";
import { CustomerFleetSettingsService } from "@/customers/customer-fleet-settings.service";
import { CustomersService } from "@/customers/customers.service";
import { PrismaService } from "@/prisma/prisma.service";
import type { NormalizedPosition } from "@/trackers/dto/index";
import { TRACKER_REDIS } from "@/trackers/ingress/tracker-redis-writer.service";
import { TrackerRedisWriterService } from "@/trackers/ingress/tracker-redis-writer.service";
import { isPointInZone } from "./geofence.utils";
import {
  ALERT_DEDUP_PREFIX,
  DEVICE_OFFLINE_DEDUP_MULT,
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
    private readonly fleetSettings: CustomerFleetSettingsService,
    private readonly customersService: CustomersService,
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

  private async vehicleCustomerId(
    organizationId: string,
    vehicleId: string | null,
  ): Promise<string | null> {
    if (!vehicleId) return null;
    const v = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
      select: { customerId: true },
    });
    return v?.customerId ?? null;
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
      select: { speedLimit: true, customerId: true },
    });
    const fleetDefault = await this.fleetSettings.resolveEffective(
      organizationId,
      vehicle?.customerId ?? null,
    );
    const limit =
      vehicle?.speedLimit ?? fleetDefault.defaultSpeedLimitKmh ?? null;
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
    const vehicleCustomerId = await this.vehicleCustomerId(
      organizationId,
      vehicleId,
    );
    const zones = await this.loadActiveGeofences(
      organizationId,
      vehicleCustomerId,
    );
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
    vehicleCustomerId: string | null,
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
    if (!vehicleCustomerId) {
      return [];
    }
    const ownerIds = await this.customersService.getCustomerIdAndAncestorIds(
      vehicleCustomerId,
      organizationId,
    );
    return this.prisma.geofenceZone.findMany({
      where: {
        organizationId,
        active: true,
        customerId: { in: ownerIds },
      },
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

  /**
   * Process a hardware alarm (SOS, power cut, shock) from GT06 alarmCode.
   * Dedup TTLs: SOS=0s (always), POWER_CUT=300s, SHOCK=60s, LOW_BATTERY(0x10)=1800s.
   */
  async processDeviceAlarm(params: {
    deviceId: string;
    organizationId: string;
    vehicleId: string | null;
    alarmCode: number;
  }): Promise<void> {
    const { deviceId, organizationId, vehicleId, alarmCode } = params;

    type AlarmDef = { type: AlertType; severity: AlertSeverity; message: string; dedupSec: number };

    const ALARM_MAP: Record<number, AlarmDef> = {
      1: { type: AlertType.SOS, severity: AlertSeverity.CRITICAL, message: "Alarme SOS acionado", dedupSec: 0 },
      2: { type: AlertType.POWER_CUT, severity: AlertSeverity.CRITICAL, message: "Corte de energia detectado", dedupSec: 300 },
      3: { type: AlertType.SHOCK, severity: AlertSeverity.WARNING, message: "Choque/vibração detectado", dedupSec: 60 },
      0x10: { type: AlertType.LOW_BATTERY, severity: AlertSeverity.WARNING, message: "Bateria fraca detectada", dedupSec: 1800 },
    };

    const def = ALARM_MAP[alarmCode];
    if (!def) return;

    await this.persistAndPublish({
      organizationId,
      vehicleId,
      deviceId,
      type: def.type,
      severity: def.severity,
      message: def.message,
      metadata: { alarmCode },
      dedupTtlSec: def.dedupSec,
    });
  }

  /** Cron: create DEVICE_OFFLINE when last position is older than threshold. */
  private envOfflineThresholdMinutes(): number {
    const raw = this.config.get<string>("DEVICE_OFFLINE_THRESHOLD_MINUTES") ?? "15";
    const p = parseInt(raw, 10);
    return Number.isFinite(p) && p >= 1 ? p : 15;
  }

  async tryCreateDeviceOfflineAlert(
    device: {
      id: string;
      organizationId: string;
      vehicleId: string | null;
      /** When known (e.g. cron), avoids an extra vehicle read. */
      vehicleCustomerId?: string | null;
    },
    opts?: { offlineThresholdMinutes?: number },
  ): Promise<void> {
    try {
      await this.runOfflineCheck(device, opts?.offlineThresholdMinutes);
    } catch (e) {
      this.logger.warn(
        `Offline alert check failed for ${device.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async runOfflineCheck(
    device: {
      id: string;
      organizationId: string;
      vehicleId: string | null;
      vehicleCustomerId?: string | null;
    },
    preloadedThresholdMinutes?: number,
  ): Promise<void> {
    let thresholdMin = preloadedThresholdMinutes;
    if (thresholdMin == null) {
      let customerId: string | null | undefined = device.vehicleCustomerId;
      if (customerId === undefined && device.vehicleId != null) {
        const v = await this.prisma.vehicle.findFirst({
          where: { id: device.vehicleId, organizationId: device.organizationId },
          select: { customerId: true },
        });
        customerId = v?.customerId ?? null;
      }
      const eff = await this.fleetSettings.resolveEffective(
        device.organizationId,
        customerId ?? null,
      );
      thresholdMin =
        eff.deviceOfflineThresholdMinutes ?? this.envOfflineThresholdMinutes();
    }
    thresholdMin = Math.max(1, thresholdMin);
    const thresholdMs = thresholdMin * 60 * 1000;
    const now = Date.now();

    let lastReceivedAtMs: number | null = null;
    const last = await this.redisWriter.getLastPosition(device.id);
    if (last?.receivedAt) {
      lastReceivedAtMs = new Date(last.receivedAt).getTime();
    } else if (last?.recordedAt) {
      // Legacy entries written before receivedAt was added — fall back to recordedAt
      lastReceivedAtMs = new Date(last.recordedAt).getTime();
    } else {
      const lastDb = await this.prisma.devicePosition.findFirst({
        where: { deviceId: device.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (lastDb) lastReceivedAtMs = lastDb.createdAt.getTime();
    }

    if (lastReceivedAtMs != null && now - lastReceivedAtMs < thresholdMs) {
      return;
    }

    const dedupSec = thresholdMin * 60 * DEVICE_OFFLINE_DEDUP_MULT;

    await this.persistAndPublish({
      organizationId: device.organizationId,
      vehicleId: device.vehicleId,
      deviceId: device.id,
      type: AlertType.DEVICE_OFFLINE,
      severity: AlertSeverity.CRITICAL,
      message: `Dispositivo sem comunicação há mais de ${thresholdMin} minutos`,
      metadata: {
        thresholdMinutes: thresholdMin,
        lastReceivedAt:
          lastReceivedAtMs != null
            ? new Date(lastReceivedAtMs).toISOString()
            : null,
      },
      dedupTtlSec: dedupSec,
    });
  }
}

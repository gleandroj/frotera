import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { CustomerFleetSettingsService } from "@/customers/customer-fleet-settings.service";
import { PrismaService } from "@/prisma/prisma.service";
import { TelemetryAlertsService } from "./telemetry-alerts.service";

@Injectable()
export class TelemetryOfflineCronService {
  private readonly logger = new Logger(TelemetryOfflineCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: TelemetryAlertsService,
    private readonly config: ConfigService,
    private readonly fleetSettings: CustomerFleetSettingsService,
  ) {}

  @Cron("*/5 * * * *")
  async checkOfflineDevices(): Promise<void> {
    const devices = await this.prisma.trackerDevice.findMany({
      where: { connectedAt: { not: null } },
      select: {
        id: true,
        organizationId: true,
        vehicle: { select: { id: true, customerId: true } },
      },
    });
    const envRaw = this.config.get<string>("DEVICE_OFFLINE_THRESHOLD_MINUTES") ?? "15";
    const envParsed = parseInt(envRaw, 10);
    const envFallback =
      Number.isFinite(envParsed) && envParsed >= 1 ? envParsed : 15;

    const pairKey = (organizationId: string, customerId: string | null) =>
      `${organizationId}\t${customerId ?? ""}`;

    const uniquePairs = new Map<
      string,
      { organizationId: string; customerId: string | null }
    >();
    for (const d of devices) {
      const customerId = d.vehicle?.customerId ?? null;
      const k = pairKey(d.organizationId, customerId);
      if (!uniquePairs.has(k)) {
        uniquePairs.set(k, { organizationId: d.organizationId, customerId });
      }
    }

    const thresholdByPair = new Map<string, number>();
    for (const { organizationId, customerId } of uniquePairs.values()) {
      const eff = await this.fleetSettings.resolveEffective(
        organizationId,
        customerId,
      );
      const t = eff.deviceOfflineThresholdMinutes ?? envFallback;
      thresholdByPair.set(pairKey(organizationId, customerId), Math.max(1, t));
    }

    for (const d of devices) {
      const customerId = d.vehicle?.customerId ?? null;
      const offlineThresholdMinutes =
        thresholdByPair.get(pairKey(d.organizationId, customerId)) ?? envFallback;
      await this.alerts.tryCreateDeviceOfflineAlert(
        {
          id: d.id,
          organizationId: d.organizationId,
          vehicleId: d.vehicle?.id ?? null,
          vehicleCustomerId: customerId,
        },
        { offlineThresholdMinutes },
      );
    }
    if (devices.length > 0) {
      this.logger.debug(`Offline cron checked ${devices.length} connected device(s)`);
    }
  }
}

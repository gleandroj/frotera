import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@/prisma/prisma.service";
import { TelemetryAlertsService } from "./telemetry-alerts.service";

@Injectable()
export class TelemetryOfflineCronService {
  private readonly logger = new Logger(TelemetryOfflineCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: TelemetryAlertsService,
  ) {}

  @Cron("*/5 * * * *")
  async checkOfflineDevices(): Promise<void> {
    const devices = await this.prisma.trackerDevice.findMany({
      where: { connectedAt: { not: null } },
      select: {
        id: true,
        organizationId: true,
        vehicle: { select: { id: true } },
      },
    });
    for (const d of devices) {
      await this.alerts.tryCreateDeviceOfflineAlert({
        id: d.id,
        organizationId: d.organizationId,
        vehicleId: d.vehicle?.id ?? null,
      });
    }
    if (devices.length > 0) {
      this.logger.debug(`Offline cron checked ${devices.length} connected device(s)`);
    }
  }
}

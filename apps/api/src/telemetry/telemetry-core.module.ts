import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "@/prisma/prisma.module";
import { TrackersModule } from "@/trackers/trackers.module";
import { TelemetryAlertsService } from "./telemetry-alerts.service";

/**
 * Minimal module for the TCP process: alert generation only (no WebSocket gateway / cron).
 */
@Module({
  imports: [PrismaModule, ConfigModule, TrackersModule],
  providers: [TelemetryAlertsService],
  exports: [TelemetryAlertsService],
})
export class TelemetryCoreModule {}

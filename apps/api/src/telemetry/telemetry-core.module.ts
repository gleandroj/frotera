import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CustomersModule } from "@/customers/customers.module";
import { PrismaModule } from "@/prisma/prisma.module";
import { TrackersCoreModule } from "@/trackers/trackers-core.module";
import { TelemetryAlertsService } from "./telemetry-alerts.service";

/**
 * Minimal module for the TCP process: alert generation only (no WebSocket gateway / cron).
 */
@Module({
  imports: [PrismaModule, ConfigModule, TrackersCoreModule, CustomersModule],
  providers: [TelemetryAlertsService],
  exports: [TelemetryAlertsService, TrackersCoreModule],
})
export class TelemetryCoreModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OrganizationsModule } from "@/organizations/organizations.module";
import { PrismaModule } from "@/prisma/prisma.module";
import { TrackersModule } from "@/trackers/trackers.module";
import { TelemetryAlertsGateway } from "./telemetry-alerts.gateway";
import { TelemetryAlertsStreamService } from "./telemetry-alerts-stream.service";
import { TelemetryController } from "./telemetry.controller";
import { TelemetryOfflineCronService } from "./telemetry-offline.cron";
import { TelemetryService } from "./telemetry.service";
import { TelemetryCoreModule } from "./telemetry-core.module";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    OrganizationsModule,
    TrackersModule,
    TelemetryCoreModule,
  ],
  controllers: [TelemetryController],
  providers: [
    TelemetryService,
    TelemetryAlertsGateway,
    TelemetryAlertsStreamService,
    TelemetryOfflineCronService,
  ],
  exports: [TelemetryService, TelemetryCoreModule],
})
export class TelemetryModule {}

/**
 * TrackersTcpModule — TCP ingress + persist cron.
 * Provides: TrackerTcpService (GT06 TCP server) and TrackerPersistCronService (Redis→Postgres).
 * Imports TelemetryCoreModule (re-exports TrackersCoreModule) for Redis, devices, and alerts.
 * Used only by TrackerAppModule (tcp-main.ts process). Never imported by the HTTP AppModule.
 */
import { Module } from "@nestjs/common";
import { TelemetryCoreModule } from "@/telemetry/telemetry-core.module";
import { TrackerTcpService } from "./ingress/tracker-tcp.service";
import { TrackerPersistCronService } from "./ingress/tracker-persist-cron.service";

@Module({
  imports: [TelemetryCoreModule],
  providers: [TrackerTcpService, TrackerPersistCronService],
})
export class TrackersTcpModule {}

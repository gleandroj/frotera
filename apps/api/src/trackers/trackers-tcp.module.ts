/**
 * TrackersTcpModule — TCP ingress + persist cron.
 * Provides: TrackerTcpService (GT06/NT20 TCP server) and TrackerPersistCronService (Redis→Postgres).
 * Imports TrackersModule so it has access to Redis, services, etc.
 * Used only by TrackerAppModule (tracker-main.ts process). Never imported by the HTTP AppModule.
 */
import { Module } from "@nestjs/common";
import { TelemetryCoreModule } from "@/telemetry/telemetry-core.module";
import { TrackersModule } from "./trackers.module";
import { TrackerTcpService } from "./ingress/tracker-tcp.service";
import { TrackerPersistCronService } from "./ingress/tracker-persist-cron.service";

@Module({
  imports: [TrackersModule, TelemetryCoreModule],
  providers: [TrackerTcpService, TrackerPersistCronService],
})
export class TrackersTcpModule {}

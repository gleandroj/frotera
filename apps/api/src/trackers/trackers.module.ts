/**
 * TrackersModule — HTTP API (devices, vehicles) + tracker-positions WebSocket.
 * Depends on TrackersCoreModule for Redis and domain services.
 */
import { Module } from "@nestjs/common";
import { AppJwtModule } from "@/auth/app-jwt.module";
import { SuperAdminGuard } from "@/auth/guards/super-admin.guard";
import { PrismaModule } from "@/prisma/prisma.module";
import { TrackerDevicesController } from "./devices/tracker-devices.controller";
import { SuperadminTrackerDiscoveriesController } from "./discovery/superadmin-tracker-discoveries.controller";
import { VehiclesController } from "./vehicles/vehicles.controller";
import {
  TrackerPositionsStreamService,
} from "./positions/tracker-positions-stream.service";
import { TrackerPositionsGateway } from "./positions/tracker-positions.gateway";
import { TrackersCoreModule } from "./trackers-core.module";

@Module({
  imports: [TrackersCoreModule, AppJwtModule, PrismaModule],
  controllers: [
    TrackerDevicesController,
    VehiclesController,
    SuperadminTrackerDiscoveriesController,
  ],
  providers: [
    TrackerPositionsStreamService,
    TrackerPositionsGateway,
    SuperAdminGuard,
  ],
  exports: [TrackersCoreModule],
})
export class TrackersModule {}

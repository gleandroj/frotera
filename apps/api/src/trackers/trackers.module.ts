/**
 * TrackersModule — HTTP API (devices, vehicles) + tracker-positions WebSocket.
 * Depends on TrackersCoreModule for Redis and domain services.
 */
import { Module } from "@nestjs/common";
import { AppJwtModule } from "@/auth/app-jwt.module";
import { PrismaModule } from "@/prisma/prisma.module";
import { TrackerDevicesController } from "./devices/tracker-devices.controller";
import { TrackerCommandsService } from "./devices/tracker-commands.service";
import { SuperadminTrackerDiscoveriesController } from "./discovery/superadmin-tracker-discoveries.controller";
import { TrackerDiscoveriesAccessGuard } from "./discovery/tracker-discoveries-access.guard";
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
    TrackerCommandsService,
    TrackerPositionsStreamService,
    TrackerPositionsGateway,
    TrackerDiscoveriesAccessGuard,
  ],
  exports: [TrackersCoreModule],
})
export class TrackersModule {}

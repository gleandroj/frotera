/**
 * TrackersModule — REST API and tracker-positions WebSocket.
 * Provides: Redis, TrackerDevicesService, VehiclesService, TrackerRedisWriterService,
 * TrackerPositionsGateway, TrackerPositionsStreamService, and the REST controllers.
 */
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createClient } from "redis";
import type { RedisClientType } from "redis";
import { PrismaModule } from "@/prisma/prisma.module";
import { TRACKER_REDIS, TrackerRedisWriterService } from "./ingress/tracker-redis-writer.service";
import { TrackerDevicesService } from "./devices/tracker-devices.service";
import { TrackerDevicesController } from "./devices/tracker-devices.controller";
import { VehiclesService } from "./vehicles/vehicles.service";
import { VehiclesController } from "./vehicles/vehicles.controller";
import {
  TRACKER_REDIS_SUB,
  TrackerPositionsStreamService,
} from "./positions/tracker-positions-stream.service";
import { TrackerPositionsGateway } from "./positions/tracker-positions.gateway";

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [TrackerDevicesController, VehiclesController],
  providers: [
    {
      provide: TRACKER_REDIS,
      useFactory: async (config: ConfigService): Promise<RedisClientType> => {
        const url = config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
        const client = createClient({ url }) as RedisClientType;
        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
    {
      provide: TRACKER_REDIS_SUB,
      useFactory: async (config: ConfigService): Promise<RedisClientType> => {
        const url = config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
        const client = createClient({ url }) as RedisClientType;
        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
    TrackerRedisWriterService,
    TrackerDevicesService,
    VehiclesService,
    TrackerPositionsStreamService,
    TrackerPositionsGateway,
  ],
  exports: [
    TrackerDevicesService,
    VehiclesService,
    TrackerRedisWriterService,
    TRACKER_REDIS,
    TRACKER_REDIS_SUB,
  ],
})
export class TrackersModule {}

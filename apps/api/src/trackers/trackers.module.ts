/**
 * TrackersModule — REST API only.
 * Provides: Redis, TrackerDevicesService, VehiclesService, TrackerRedisWriterService,
 * and the REST controllers. Used by AppModule (HTTP process).
 * Does NOT include the TCP server or the persist cron.
 */
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createClient } from "redis";
import type { RedisClientType } from "redis";
import { PrismaModule } from "@/prisma/prisma.module";
import { AuthModule } from "@/auth/auth.module";
import { TRACKER_REDIS, TrackerRedisWriterService } from "./ingress/tracker-redis-writer.service";
import { TrackerDevicesService } from "./devices/tracker-devices.service";
import { TrackerDevicesController } from "./devices/tracker-devices.controller";
import { VehiclesService } from "./vehicles/vehicles.service";
import { VehiclesController } from "./vehicles/vehicles.controller";

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
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
    TrackerRedisWriterService,
    TrackerDevicesService,
    VehiclesService,
  ],
  exports: [TrackerDevicesService, VehiclesService, TrackerRedisWriterService, TRACKER_REDIS],
})
export class TrackersModule {}

/**
 * TrackersCoreModule — Redis ingress, device/vehicle services.
 * Loaded by the TCP worker and by telemetry core; no HTTP controllers or WebSockets.
 */
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createClient } from "redis";
import type { RedisClientType } from "redis";
import { PrismaModule } from "@/prisma/prisma.module";
import { TRACKER_REDIS, TrackerRedisWriterService } from "./ingress/tracker-redis-writer.service";
import { TrackerDevicesService } from "./devices/tracker-devices.service";
import { VehiclesService } from "./vehicles/vehicles.service";
import { TRACKER_REDIS_SUB } from "./positions/tracker-positions-stream.service";

@Module({
  imports: [ConfigModule, PrismaModule],
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
  ],
  exports: [
    TrackerDevicesService,
    VehiclesService,
    TrackerRedisWriterService,
    TRACKER_REDIS,
    TRACKER_REDIS_SUB,
  ],
})
export class TrackersCoreModule {}

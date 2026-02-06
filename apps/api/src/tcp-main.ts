/**
 * Entry point for the tracker TCP process (no HTTP).
 * Boots a minimal NestJS context with only: Config, Prisma, Schedule, and TrackersTcpModule.
 * The TCP server (GT06/NT20) and the persist cron (Redis→Postgres) run here.
 *
 * Usage:
 *   pnpm run start:tracker        (production)
 *   pnpm run dev:tracker           (dev with watch)
 */
import { NestFactory } from "@nestjs/core";
import { TcpAppModule } from "./tcp-app.module";
import { RedisIoAdapter } from "./websockets/redis-io-adapter";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";

if (!(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(TcpAppModule);
  const configService = app.get(ConfigService);

  // Setup Redis adapter for WebSockets (BullMQ queues)
  const redisIoAdapter = new RedisIoAdapter(configService, app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await app.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await app.close();
    process.exit(0);
  });

  console.log(`TCP App process started.`);
}

bootstrap();

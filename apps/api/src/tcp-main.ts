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

if (!(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(TcpAppModule);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await app.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await app.close();
    process.exit(0);
  });

  console.log(`TCP App process started on port ${process.env.TRACKER_TCP_PORT}.`);
}

bootstrap();

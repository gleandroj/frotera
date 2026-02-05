/**
 * TrackerAppModule — root module for the tracker-only process.
 * Boots a minimal NestJS context: Config, Schedule (cron), Prisma, and TrackersTcpModule.
 * No HTTP controllers, no auth, no admin, no email, etc.
 */
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { TrackersTcpModule } from "./trackers/trackers-tcp.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: "../../.env",
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    TrackersTcpModule,
  ],
})
export class TcpAppModule {}

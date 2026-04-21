import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: "event", level: "query" },
        { emit: "event", level: "error" },
        { emit: "event", level: "info" },
        { emit: "event", level: "warn" },
      ],
    });
  }

  async onModuleInit() {
    try {
      this.logger.log("Connecting to database...");
      await Promise.race([
        this.$connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database connection timeout after 10s")), 10000)
        ),
      ]);
      this.logger.log("Successfully connected to database");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("🔴 Failed to connect to database:", message);
      this.logger.error("Failed to connect to database", error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      this.logger.log("Disconnecting from database...");
      await this.$disconnect();
      this.logger.log("Successfully disconnected from database");
    } catch (error) {
      this.logger.error("Failed to disconnect from database", error);
      throw error;
    }
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  async checkHealth() {
    const checks = {
      database: await this.checkDatabase(),
      email: await this.checkEmail(),
      environment: this.checkEnvironment(),
    };

    const status = Object.values(checks).every((check) => check.status === "ok")
      ? "ok"
      : "error";
    const errors = Object.values(checks)
      .filter((check) => check.status === "error")
      .map((check) => check.error)
      .filter(Boolean);

    return {
      status,
      timestamp: new Date().toISOString(),
      environment: this.configService.get("NODE_ENV"),
      checks,
      errors,
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok" as const };
    } catch (error) {
      this.logger.error("Database health check failed", error);
      return {
        status: "error" as const,
        error: "Database connection failed",
      };
    }
  }

  private async checkEmail() {
    try {
      // Check if email configuration is present
      const requiredEnvVars = [
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USER",
        "SMTP_PASS",
      ];
      const missingVars = requiredEnvVars.filter(
        (varName) => !this.configService.get(varName)
      );

      if (missingVars.length > 0) {
        return {
          status: "error" as const,
          error: `Missing email configuration: ${missingVars.join(", ")}`,
        };
      }

      return { status: "ok" as const };
    } catch (error) {
      this.logger.error("Email health check failed", error);
      return {
        status: "error" as const,
        error: "Email service configuration failed",
      };
    }
  }

  private checkEnvironment() {
    const requiredEnvVars = [
      "DATABASE_URL",
      "JWT_SECRET",
      "JWT_REFRESH_SECRET",
      "JWT_VERIFICATION_SECRET",
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !this.configService.get(varName)
    );

    if (missingVars.length > 0) {
      return {
        status: "error" as const,
        error: `Missing environment variables: ${missingVars.join(", ")}`,
      };
    }

    return { status: "ok" as const };
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

@Injectable()
export class SuspensionGuard implements CanActivate {
  private readonly logger = new Logger(SuspensionGuard.name);

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const isSuspended = this.configService.get<string>("SERVICE_SUSPENDED");

    // If service is not suspended, allow the request
    if (!isSuspended || isSuspended.toLowerCase() !== "true") {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    // Allow health check endpoints even when suspended
    if (path.startsWith("/api/health") || path === "/health") {
      this.logger.log(
        `[Suspension Guard] Allowing health check: ${path}`
      );
      return true;
    }

    // Block all other requests
    this.logger.warn(
      `[Suspension Guard] Service is suspended. Blocking request to: ${path}`
    );
    throw new ServiceUnavailableException({
      statusCode: 503,
      message: "Service is currently suspended",
      error: "Service Unavailable",
    });
  }
}

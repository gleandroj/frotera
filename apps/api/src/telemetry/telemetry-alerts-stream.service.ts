import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import type { RedisClientType } from "redis";
import type { Server } from "socket.io";
import { TRACKER_REDIS_SUB } from "@/trackers/positions/tracker-positions-stream.service";
import { TELEMETRY_ALERT_CHANNEL } from "./telemetry-alerts.constants";

export interface TelemetryAlertPubPayload {
  organizationId: string;
  alert: Record<string, unknown>;
}

@Injectable()
export class TelemetryAlertsStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(TelemetryAlertsStreamService.name);
  private server: Server | null = null;
  private started = false;

  constructor(
    @Inject(TRACKER_REDIS_SUB) private readonly redisSub: RedisClientType,
  ) {}

  setServer(server: Server): void {
    this.server = server;
    void this.ensureSubscribed();
  }

  private async ensureSubscribed(): Promise<void> {
    if (this.started || !this.server) return;
    this.started = true;
    const listener = (message: string, channel: string) => {
      if (channel !== TELEMETRY_ALERT_CHANNEL || !this.server) return;
      try {
        const payload = JSON.parse(message) as TelemetryAlertPubPayload;
        if (!payload?.organizationId || !payload?.alert) return;
        this.server
          .to(`org:${payload.organizationId}`)
          .emit("telemetry:alert", payload.alert);
      } catch {
        this.logger.warn("Invalid telemetry alert pub/sub message");
      }
    };
    await this.redisSub.subscribe(TELEMETRY_ALERT_CHANNEL, listener);
    this.logger.log(`Subscribed to ${TELEMETRY_ALERT_CHANNEL}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.started) return;
    try {
      await this.redisSub.unsubscribe(TELEMETRY_ALERT_CHANNEL);
    } catch {
      /* ignore */
    }
    this.started = false;
  }
}

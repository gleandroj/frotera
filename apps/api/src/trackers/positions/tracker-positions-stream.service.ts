import { Injectable, Inject, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RedisClientType } from "redis";
import type { Server } from "socket.io";

export const TRACKER_REDIS_SUB = "TRACKER_REDIS_SUB";

export interface PositionPayload {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
}

const ROOM_PREFIX = "device:";
const CHANNEL_PREFIX = "tracker:position:";

interface DeviceState {
  buffer: PositionPayload[];
  flushTimer: ReturnType<typeof setInterval> | null;
  subscriberCount: number;
}

@Injectable()
export class TrackerPositionsStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(TrackerPositionsStreamService.name);
  private server: Server | null = null;
  private readonly deviceState = new Map<string, DeviceState>();
  private readonly batchMs: number;
  private readonly batchSize: number;

  constructor(
    @Inject(TRACKER_REDIS_SUB) private readonly redisSub: RedisClientType,
    private readonly config: ConfigService,
  ) {
    this.batchMs =
      this.config.get<number>("TRACKER_POSITIONS_BATCH_MS") ?? 500;
    this.batchSize =
      this.config.get<number>("TRACKER_POSITIONS_BATCH_SIZE") ?? 10;
  }

  setServer(server: Server): void {
    this.server = server;
  }

  private getChannel(deviceId: string): string {
    return `${CHANNEL_PREFIX}${deviceId}`;
  }

  private getRoom(deviceId: string): string {
    return `${ROOM_PREFIX}${deviceId}`;
  }

  private flush(deviceId: string): void {
    const state = this.deviceState.get(deviceId);
    if (!state || state.buffer.length === 0 || !this.server) return;

    const batch = state.buffer.splice(0, state.buffer.length);
    const room = this.getRoom(deviceId);
    this.server.to(room).emit("positions:batch", batch);
    this.logger.debug(`Flushed ${batch.length} positions to room ${room}`);
  }

  private ensureSubscribed(deviceId: string): void {
    const channel = this.getChannel(deviceId);
    const state = this.deviceState.get(deviceId);
    if (!state || state.subscriberCount === 0) return;

    if (state.flushTimer === null) {
      state.flushTimer = setInterval(() => {
        this.flush(deviceId);
      }, this.batchMs);

      // In node-redis v4+, the listener is passed directly to subscribe()
      // and receives (message, channel) — there is no "message" event.
      this.redisSub.subscribe(channel, (message, channel) => {
        if (!channel.startsWith(CHANNEL_PREFIX)) return;
        const id = channel.slice(CHANNEL_PREFIX.length);
        const devState = this.deviceState.get(id);
        if (!devState) return;
        try {
          const payload = JSON.parse(message) as PositionPayload;
          devState.buffer.push(payload);
          if (devState.buffer.length >= this.batchSize) {
            this.flush(id);
          }
        } catch {
          this.logger.warn(`Invalid position message on ${channel}`);
        }
      });
    }
  }

  private async unsubscribeFromDevice(deviceId: string): Promise<void> {
    const state = this.deviceState.get(deviceId);
    if (!state) return;

    if (state.flushTimer) {
      clearInterval(state.flushTimer);
      state.flushTimer = null;
    }
    this.flush(deviceId);
    const channel = this.getChannel(deviceId);
    await this.redisSub.unsubscribe(channel);
    this.deviceState.delete(deviceId);
    this.logger.debug(`Unsubscribed from Redis channel ${channel}`);
  }

  addSubscriber(deviceId: string): void {
    let state = this.deviceState.get(deviceId);
    if (!state) {
      state = {
        buffer: [],
        flushTimer: null,
        subscriberCount: 0,
      };
      this.deviceState.set(deviceId, state);
    }
    state.subscriberCount += 1;
    this.ensureSubscribed(deviceId);
  }

  async removeSubscriber(deviceId: string): Promise<void> {
    const state = this.deviceState.get(deviceId);
    if (!state) return;

    state.subscriberCount -= 1;
    if (state.subscriberCount <= 0) {
      await this.unsubscribeFromDevice(deviceId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const deviceId of this.deviceState.keys()) {
      await this.unsubscribeFromDevice(deviceId);
    }
  }
}

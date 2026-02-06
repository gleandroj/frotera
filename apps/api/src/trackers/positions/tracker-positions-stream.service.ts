import { Injectable, Inject, Logger, OnModuleDestroy } from "@nestjs/common";
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
  subscriberCount: number;
}

@Injectable()
export class TrackerPositionsStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(TrackerPositionsStreamService.name);
  private server: Server | null = null;
  private readonly deviceState = new Map<string, DeviceState>();

  constructor(
    @Inject(TRACKER_REDIS_SUB) private readonly redisSub: RedisClientType,
  ) {}

  setServer(server: Server): void {
    this.server = server;
    this.logger.log("Socket.IO server set for position stream");
  }

  private getChannel(deviceId: string): string {
    return `${CHANNEL_PREFIX}${deviceId}`;
  }

  private getRoom(deviceId: string): string {
    return `${ROOM_PREFIX}${deviceId}`;
  }

  private async ensureSubscribed(deviceId: string): Promise<void> {
    this.logger.log(`ensureSubscribed: deviceId=${deviceId}`);
    const channel = this.getChannel(deviceId);
    const state = this.deviceState.get(deviceId);
    if (!state || state.subscriberCount === 0) {
      this.logger.debug(
        `Skip Redis subscribe for device ${deviceId}: no subscribers (count=${state?.subscriberCount ?? 0})`,
      );
      return;
    }

    const listener = (message: string, ch: string) => {
      if (!ch.startsWith(CHANNEL_PREFIX)) return;
      const id = ch.slice(CHANNEL_PREFIX.length);
      if (!this.deviceState.has(id) || !this.server) return;
      try {
        const payload = JSON.parse(message) as PositionPayload;
        this.server.to(this.getRoom(id)).emit("positions:batch", [payload]);
        this.logger.debug(
          `Emitted position to room device:${id} (${payload.latitude},${payload.longitude})`,
        );
      } catch {
        this.logger.warn(`Invalid position message on ${ch}`);
      }
    };
    await this.redisSub.subscribe(channel, listener);
    this.logger.log(`Subscribed to Redis channel ${channel} for device ${deviceId} (subscribers=${state.subscriberCount})`);
  }

  private async unsubscribeFromDevice(deviceId: string): Promise<void> {
    const state = this.deviceState.get(deviceId);
    if (!state) return;

    const channel = this.getChannel(deviceId);
    await this.redisSub.unsubscribe(channel);
    this.deviceState.delete(deviceId);
    this.logger.log(`Unsubscribed from Redis channel ${channel} for device ${deviceId}`);
  }

  async addSubscriber(deviceId: string): Promise<void> {
    let state = this.deviceState.get(deviceId);
    if (!state) {
      state = { subscriberCount: 0 };
      this.deviceState.set(deviceId, state);
    }
    state.subscriberCount += 1;
    this.logger.debug(`Added subscriber for device ${deviceId} (total=${state.subscriberCount})`);
    await this.ensureSubscribed(deviceId);
  }

  async removeSubscriber(deviceId: string): Promise<void> {
    const state = this.deviceState.get(deviceId);
    if (!state) {
      this.logger.debug(`removeSubscriber: no state for device ${deviceId}`);
      return;
    }

    state.subscriberCount -= 1;
    this.logger.debug(`Removed subscriber for device ${deviceId} (remaining=${state.subscriberCount})`);
    if (state.subscriberCount <= 0) {
      await this.unsubscribeFromDevice(deviceId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const count = this.deviceState.size;
    if (count > 0) {
      this.logger.log(`Unsubscribing from ${count} device channel(s) on destroy`);
    }
    for (const deviceId of this.deviceState.keys()) {
      await this.unsubscribeFromDevice(deviceId);
    }
  }
}

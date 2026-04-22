import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { RedisClientType } from "redis";
import { TRACKER_REDIS } from "../ingress/tracker-redis.tokens";
import { TrackerDevicesService } from "./tracker-devices.service";

const COMMAND_CHANNEL = "tracker:device-cmd";

@Injectable()
export class TrackerCommandsService {
  constructor(
    @Inject(TRACKER_REDIS) private readonly redis: RedisClientType,
    private readonly devicesService: TrackerDevicesService,
  ) {}

  async sendCommand(
    organizationId: string,
    deviceId: string,
    commandStr: string,
  ): Promise<{ sent: boolean }> {
    const device = await this.devicesService.findByOrganizationAndId(
      organizationId,
      deviceId,
    );
    if (!device.connectedAt) {
      throw new BadRequestException("Device is not connected");
    }
    await this.redis.publish(
      COMMAND_CHANNEL,
      JSON.stringify({ deviceId, commandStr }),
    );
    return { sent: true };
  }
}

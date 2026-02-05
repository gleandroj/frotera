import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import { PrismaService } from "@/prisma/prisma.service";
import { TrackerDevicesService } from "../devices/tracker-devices.service";
import { TrackerPositionsStreamService } from "./tracker-positions-stream.service";

interface AuthPayload {
  userId: string;
  organizationId: string;
}

function getAuth(socket: Socket): AuthPayload | null {
  const auth = socket.handshake.auth as {
    token?: string;
    organizationId?: string;
  };
  if (!auth?.organizationId) return null;
  const payload = (socket as Socket & { authPayload?: AuthPayload }).authPayload;
  return payload ?? null;
}

@WebSocketGateway({
  namespace: "tracker-positions",
  cors: { origin: true },
})
export class TrackerPositionsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TrackerPositionsGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly devicesService: TrackerDevicesService,
    private readonly streamService: TrackerPositionsStreamService,
  ) {}

  afterInit(server: Server): void {
    this.streamService.setServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth as { token?: string }).token ??
      (client.handshake.headers.authorization?.startsWith("Bearer ")
        ? client.handshake.headers.authorization.slice(7)
        : undefined);
    const organizationId = (client.handshake.auth as { organizationId?: string })
      .organizationId;

    if (!token || !organizationId) {
      this.logger.warn("Tracker positions connection without token or org");
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>("JWT_SECRET"),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, emailVerified: true },
      });

      if (!user || !user.emailVerified) {
        client.disconnect(true);
        return;
      }

      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: payload.userId,
            organizationId,
          },
        },
      });

      if (!membership) {
        client.disconnect(true);
        return;
      }

      (client as Socket & { authPayload?: AuthPayload }).authPayload = {
        userId: payload.userId,
        organizationId,
      };
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const subs = (client as Socket & { subscribedDeviceIds?: Set<string> })
      .subscribedDeviceIds;
    if (subs) {
      for (const deviceId of subs) {
        this.streamService.removeSubscriber(deviceId);
      }
    }
  }

  @SubscribeMessage("subscribe")
  async handleSubscribe(
    client: Socket,
    payload: { deviceId?: string },
  ): Promise<void> {
    const auth = getAuth(client);
    if (!auth || !payload?.deviceId) {
      return;
    }

    try {
      await this.devicesService.findByOrganizationAndId(
        auth.organizationId,
        payload.deviceId,
      );
    } catch {
      return;
    }

    const deviceId = payload.deviceId;
    client.join(`device:${deviceId}`);
    let subs = (client as Socket & { subscribedDeviceIds?: Set<string> })
      .subscribedDeviceIds;
    if (!subs) {
      subs = new Set();
      (client as Socket & { subscribedDeviceIds?: Set<string> }).subscribedDeviceIds =
        subs;
    }
    subs.add(deviceId);
    this.streamService.addSubscriber(deviceId);
  }

  @SubscribeMessage("unsubscribe")
  async handleUnsubscribe(
    client: Socket,
    payload: { deviceId?: string },
  ): Promise<void> {
    if (!payload?.deviceId) return;

    const deviceId = payload.deviceId;
    client.leave(`device:${deviceId}`);
    const subs = (client as Socket & { subscribedDeviceIds?: Set<string> })
      .subscribedDeviceIds;
    if (subs) {
      subs.delete(deviceId);
    }
    await this.streamService.removeSubscriber(deviceId);
  }
}

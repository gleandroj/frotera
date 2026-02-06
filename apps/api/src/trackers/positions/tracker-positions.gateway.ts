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

/** Socket with optional auth payload set after successful JWT verification */
type AuthenticatedSocket = Socket & { authPayload?: AuthPayload };

/** Socket with optional set of device IDs the client is subscribed to */
type SubscribingSocket = Socket & { subscribedDeviceIds?: Set<string> };

function getAuth(socket: AuthenticatedSocket): AuthPayload | null {
  const payload = (socket as AuthenticatedSocket).authPayload;
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
    this.logger.log(`Tracker positions connection from ${client.id}`);

    const token =
      (client.handshake.auth as { token?: string }).token ??
      (client.handshake.headers.authorization?.startsWith("Bearer ")
        ? client.handshake.headers.authorization.slice(7)
        : undefined);

    const organizationId = (
      client.handshake.auth as { organizationId?: string }
    ).organizationId;

    this.logger.log(
      `Tracker positions connection: handshake organizationId=${organizationId}`,
    );

    if (!token || !organizationId) {
      this.logger.warn("Tracker positions connection without token or org");
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>("JWT_SECRET"),
      });
      this.logger.log(
        `Tracker positions connection: payload=${JSON.stringify(payload)}`,
      );

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, emailVerified: true },
      });
      this.logger.log(
        `Tracker positions connection: user=${JSON.stringify(user)}`,
      );

      if (!user || !user.emailVerified) {
        this.logger.log(
          `Tracker positions connection: user not found or email not verified`,
        );
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
      this.logger.log(
        `Tracker positions connection: membership=${JSON.stringify(membership)}`,
      );

      if (!membership) {
        client.disconnect(true);
        return;
      }

      (client as AuthenticatedSocket).authPayload = {
        userId: payload.userId,
        organizationId,
      };
      this.logger.log(
        `Tracker positions connection: authPayload=${JSON.stringify((client as AuthenticatedSocket).authPayload)}`,
      );
    } catch {
      this.logger.log(`Tracker positions connection: error`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const subs = (client as SubscribingSocket).subscribedDeviceIds;
    if (subs) {
      for (const deviceId of subs) {
        this.streamService.removeSubscriber(deviceId);
      }
    }
  }

  @SubscribeMessage("subscribe")
  async handleSubscribe(
    client: AuthenticatedSocket,
    payload: { deviceId?: string },
  ): Promise<void> {
    this.logger.log(`handleSubscribe: payload=${JSON.stringify(payload)}`);
    const auth = getAuth(client);
    if (!auth || !payload?.deviceId) {
      this.logger.log(`handleSubscribe: auth or deviceId not found`);
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
    const subSocket = client as SubscribingSocket;
    let subs = subSocket.subscribedDeviceIds;
    if (!subs) {
      subs = new Set();
      subSocket.subscribedDeviceIds = subs;
    }
    subs.add(deviceId);
    this.logger.log(`Subscribed to device ${deviceId} (total=${subs.size})`);
    await this.streamService.addSubscriber(deviceId);
    client.emit("subscribed", { deviceId });
  }

  @SubscribeMessage("unsubscribe")
  async handleUnsubscribe(
    client: Socket,
    payload: { deviceId?: string },
  ): Promise<void> {
    if (!payload?.deviceId) return;

    const deviceId = payload.deviceId;
    client.leave(`device:${deviceId}`);
    const subs = (client as SubscribingSocket).subscribedDeviceIds;
    if (subs) {
      subs.delete(deviceId);
    }
    await this.streamService.removeSubscriber(deviceId);
  }
}

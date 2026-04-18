import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import { PrismaService } from "@/prisma/prisma.service";
import { TelemetryAlertsStreamService } from "./telemetry-alerts-stream.service";

interface AuthPayload {
  userId: string;
  organizationId: string;
}

type AuthedSocket = Socket & { authPayload?: AuthPayload };

@WebSocketGateway({
  namespace: "telemetry-alerts",
  cors: { origin: true },
})
export class TelemetryAlertsGateway
  implements OnGatewayInit, OnGatewayConnection
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TelemetryAlertsGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly streamService: TelemetryAlertsStreamService,
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
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ userId: string }>(
        token,
        { secret: this.config.get<string>("JWT_SECRET") },
      );

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, emailVerified: true },
      });
      if (!user?.emailVerified) {
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

      (client as AuthedSocket).authPayload = {
        userId: payload.userId,
        organizationId,
      };
      await client.join(`org:${organizationId}`);
      this.logger.debug(`telemetry-alerts joined org:${organizationId}`);
    } catch {
      client.disconnect(true);
    }
  }
}

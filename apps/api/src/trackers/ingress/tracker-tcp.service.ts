import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as net from "net";
import { PrismaService } from "@/prisma/prisma.service";
import { TrackerDevicesService } from "../devices/tracker-devices.service";
import { TrackerRedisWriterService } from "./tracker-redis-writer.service";
import {
  isGT06Packet,
  getGT06PacketLength,
  tryParseGT06Packet,
  isGT06Login,
  isGT06Location,
  isGT06Heartbeat,
  getImeiFromGT06Login,
  getGT06ProtocolName,
  parseGT06LocationToPosition,
  buildGT06LoginAck,
  buildGT06HeartbeatAck,
  buildGT06LocationAck,
} from "../protocols/gt06.parser";

interface ParsedPacket {
  protocolNumber: number;
  content: Buffer;
  serialNumber: number;
  fullLength: number;
}

interface SocketContext {
  buffer: Buffer;
  deviceId: string | null;
  imei: string | null;
  protocol: "GT06" | null;
}

@Injectable()
export class TrackerTcpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackerTcpService.name);
  private server: net.Server | null = null;
  private readonly socketContexts = new Map<net.Socket, SocketContext>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly trackerDevices: TrackerDevicesService,
    private readonly redisWriter: TrackerRedisWriterService,
  ) {
    this.logger.log(`Tracker TCP service constructor...`);
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`Tracker TCP server onModuleInit...`);
    const port = parseInt(
      this.config.get<string>("TRACKER_TCP_PORT") ?? "5023",
      10,
    );
    this.server = net.createServer((socket) => this.handleConnection(socket));
    this.server.listen(port, () => {
      this.logger.log(`Tracker TCP server listening on port ${port}`);
    });
    this.server.on("error", (err) => {
      this.logger.error(`Tracker TCP server error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.logger.log("Tracker TCP server closed");
    }
    for (const ctx of this.socketContexts.values()) {
      if (ctx.deviceId) this.markDisconnected(ctx.deviceId);
    }
    this.socketContexts.clear();
  }

  private markConnected(deviceId: string): void {
    this.prisma.trackerDevice
      .update({
        where: { id: deviceId },
        data: { connectedAt: new Date() },
      })
      .catch((err) =>
        this.logger.warn(`Failed to set device ${deviceId} connected: ${err.message}`),
      );
  }

  private markDisconnected(deviceId: string): void {
    this.prisma.trackerDevice
      .update({
        where: { id: deviceId },
        data: { connectedAt: null },
      })
      .catch((err) =>
        this.logger.warn(`Failed to set device ${deviceId} disconnected: ${err.message}`),
      );
  }

  private handleConnection(socket: net.Socket): void {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    this.logger.debug(`New connection from ${remote}`);

    const ctx: SocketContext = {
      buffer: Buffer.alloc(0),
      deviceId: null,
      imei: null,
      protocol: null,
    };
    this.socketContexts.set(socket, ctx);

    socket.on("data", (data: Buffer) => {
      const hexPreview =
        data.length <= 64 ? data.toString("hex") : `${data.subarray(0, 32).toString("hex")}...`;
      const hint =
        data.length >= 2 && data[0] === 0x78 && data[1] === 0x78
          ? " (GT06?)"
          : data.length >= 2 && data[0] === 0x79 && data[1] === 0x79
            ? " (GT06 adv?)"
            : "";
      this.logger.debug(
        `[${remote}] Received ${data.length} bytes${hint} | hex: ${hexPreview}`,
      );
      ctx.buffer = Buffer.concat([ctx.buffer, data]);
      this.processBuffer(socket, ctx);
    });

    socket.on("end", () => {
      this.logger.debug(`Connection ended: ${remote}`);
      const ctx = this.socketContexts.get(socket);
      this.socketContexts.delete(socket);
      if (ctx?.deviceId) this.markDisconnected(ctx.deviceId);
    });

    socket.on("error", (err) => {
      this.logger.warn(`Socket error: ${err.message}`);
      const ctx = this.socketContexts.get(socket);
      this.socketContexts.delete(socket);
      if (ctx?.deviceId) this.markDisconnected(ctx.deviceId);
    });
  }

  private processBuffer(socket: net.Socket, ctx: SocketContext): void {
    while (ctx.buffer.length >= 10) {
      let parsed: ParsedPacket | null = null;
      let fullLength = 0;

      if (isGT06Packet(ctx.buffer)) {
        fullLength = getGT06PacketLength(ctx.buffer) ?? 0;
        if (fullLength > 0 && ctx.buffer.length >= fullLength) {
          parsed = tryParseGT06Packet(ctx.buffer);
          if (parsed) {
            if (ctx.protocol === null) ctx.protocol = "GT06";
            fullLength = parsed.fullLength;
          }
        }
      }

      if (!parsed) {
        const preview = ctx.buffer.subarray(0, Math.min(8, ctx.buffer.length)).toString("hex");
        this.logger.debug(
          `No packet parsed (invalid or unknown format), skipping 1 byte | buffer=${ctx.buffer.length} bytes, start: ${preview}...`,
        );
        ctx.buffer = ctx.buffer.subarray(1);
        continue;
      }

      this.logger.debug(
        `[GT06] Packet: ${getGT06ProtocolName(parsed!.protocolNumber)} | serial=${parsed!.serialNumber} | length=${fullLength} bytes`,
      );
      ctx.buffer = ctx.buffer.subarray(fullLength);
      this.handleGT06Packet(socket, ctx, parsed!);
    }
  }

  private async handleGT06Packet(
    socket: net.Socket,
    ctx: SocketContext,
    parsed: ParsedPacket,
  ): Promise<void> {
    if (isGT06Login(parsed.protocolNumber)) {
      const imei = getImeiFromGT06Login(parsed.content);
      this.logger.log(
        `[GT06] Login | IMEI=${imei ?? "invalid"} | serial=${parsed.serialNumber}`,
      );
      socket.write(buildGT06LoginAck(parsed.serialNumber));
      if (!imei) return;

      const device = await this.trackerDevices.findByImei(imei);
      if (device) {
        ctx.deviceId = device.id;
        ctx.imei = device.imei;
        this.markConnected(device.id);
        this.logger.log(
          `[GT06] Login | IMEI=${imei} | deviceId=${device.id} | OK (pre-registered)`,
        );
      } else {
        this.logger.log(
          `[GT06] Login | IMEI=${imei} | rejected (device must be pre-registered)`,
        );
      }
      return;
    }

    if (isGT06Heartbeat(parsed.protocolNumber)) {
      this.logger.log(
        `[GT06] Heartbeat | IMEI=${ctx.imei ?? "—"} | deviceId=${ctx.deviceId ?? "—"} | serial=${parsed.serialNumber}`,
      );
      socket.write(buildGT06HeartbeatAck(parsed.serialNumber, parsed.protocolNumber));
      return;
    }

    if (isGT06Location(parsed.protocolNumber)) {
      socket.write(buildGT06LocationAck(parsed.serialNumber, parsed.protocolNumber));
      const position = parseGT06LocationToPosition(
        parsed.protocolNumber,
        parsed.content,
      );
      const posStr = position
        ? `lat=${position.latitude.toFixed(5)} lng=${position.longitude.toFixed(5)} @ ${position.recordedAt}`
        : "parse failed";
      this.logger.log(
        `[GT06] Location | IMEI=${ctx.imei ?? "—"} | deviceId=${ctx.deviceId ?? "—"} | serial=${parsed.serialNumber} | ${posStr}`,
      );
      if (position && ctx.deviceId && ctx.imei) {
        await this.redisWriter.pushPosition(ctx.deviceId, ctx.imei, position);
      }
    }
  }
}

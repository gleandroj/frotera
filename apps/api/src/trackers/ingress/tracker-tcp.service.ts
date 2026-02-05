import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as net from "net";
import { TrackerModel } from "@prisma/client";
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
  getPositionFromGT06Location,
  buildGT06LoginAck,
  buildGT06HeartbeatAck,
  buildGT06LocationAck,
} from "../protocols/gt06.parser";
import { tryParseNT20Packet, isNT20Packet } from "../protocols/nt20.parser";

type ProtocolKind = "GT06" | "NT20";

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
  protocol: ProtocolKind | null;
}

@Injectable()
export class TrackerTcpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackerTcpService.name);
  private server: net.Server | null = null;
  private readonly socketContexts = new Map<net.Socket, SocketContext>();

  constructor(
    private readonly config: ConfigService,
    private readonly trackerDevices: TrackerDevicesService,
    private readonly redisWriter: TrackerRedisWriterService,
  ) {}

  async onModuleInit(): Promise<void> {
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
    this.socketContexts.clear();
  }

  private handleConnection(socket: net.Socket): void {
    const ctx: SocketContext = {
      buffer: Buffer.alloc(0),
      deviceId: null,
      imei: null,
      protocol: null,
    };
    this.socketContexts.set(socket, ctx);

    socket.on("data", (data: Buffer) => {
      ctx.buffer = Buffer.concat([ctx.buffer, data]);
      this.processBuffer(socket, ctx);
    });

    socket.on("end", () => {
      this.socketContexts.delete(socket);
    });

    socket.on("error", (err) => {
      this.logger.warn(`Socket error: ${err.message}`);
      this.socketContexts.delete(socket);
    });
  }

  private processBuffer(socket: net.Socket, ctx: SocketContext): void {
    while (ctx.buffer.length >= 10) {
      let parsed: ParsedPacket | null = null;
      let fullLength = 0;

      if (ctx.protocol === "GT06" || ctx.protocol === null) {
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
      }

      if (!parsed && ctx.protocol === null && isNT20Packet(ctx.buffer)) {
        const nt20 = tryParseNT20Packet(ctx.buffer);
        if (nt20) {
          parsed = nt20;
          ctx.protocol = "NT20";
          fullLength = nt20.fullLength;
        }
      }

      if (!parsed) {
        ctx.buffer = ctx.buffer.subarray(1);
        continue;
      }

      ctx.buffer = ctx.buffer.subarray(fullLength);

      if (ctx.protocol === "GT06" && parsed) {
        this.handleGT06Packet(socket, ctx, parsed);
      }
    }
  }

  private async handleGT06Packet(
    socket: net.Socket,
    ctx: SocketContext,
    parsed: ParsedPacket,
  ): Promise<void> {
    if (isGT06Login(parsed.protocolNumber)) {
      const imei = getImeiFromGT06Login(parsed.content);
      if (!imei) {
        socket.write(buildGT06LoginAck(parsed.serialNumber));
        return;
      }
      const device = await this.trackerDevices.findByImei(imei);
      const autoRegisterOrgId = this.config.get<string>(
        "TRACKER_AUTO_REGISTER_ORGANIZATION_ID",
      );
      if (!device && autoRegisterOrgId) {
        const { deviceId } = await this.trackerDevices.createDeviceAndVehicle(
          autoRegisterOrgId,
          imei,
          TrackerModel.X12_GT06,
        );
        ctx.deviceId = deviceId;
        ctx.imei = imei;
        this.logger.log(`Auto-registered device IMEI ${imei} -> deviceId ${deviceId}`);
      } else if (device) {
        ctx.deviceId = device.id;
        ctx.imei = device.imei;
      }
      socket.write(buildGT06LoginAck(parsed.serialNumber));
      return;
    }

    if (isGT06Heartbeat(parsed.protocolNumber)) {
      socket.write(buildGT06HeartbeatAck(parsed.serialNumber));
      return;
    }

    if (isGT06Location(parsed.protocolNumber)) {
      const position = getPositionFromGT06Location(parsed.content);
      if (position && ctx.deviceId && ctx.imei) {
        await this.redisWriter.pushPosition(ctx.deviceId, ctx.imei, position);
      }
      socket.write(buildGT06LocationAck(parsed.serialNumber));
    }
  }
}

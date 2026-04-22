import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as net from "net";
import { PrismaService } from "@/prisma/prisma.service";
import { TrackerDevicesService } from "../devices/tracker-devices.service";
import { TrackerDiscoveryService } from "../discovery/tracker-discovery.service";
import { NormalizedPosition } from "../dto/index";
import { TrackerRedisWriterService } from "./tracker-redis-writer.service";
import { TelemetryAlertsService } from "@/telemetry/telemetry-alerts.service";
import {
  isGT06Packet,
  getGT06PacketLength,
  tryParseGT06Packet,
  isGT06Login,
  isGT06Location,
  isGT06Heartbeat,
  isGT06AlarmPacket,
  getImeiFromGT06Login,
  getGT06ProtocolName,
  parseGT06LocationToPosition,
  parseGT06HeartbeatStatus,
  parseGT06AlarmPacket,
  buildGT06LoginAck,
  buildGT06HeartbeatAck,
  buildGT06LocationAck,
  buildGT06AlarmAck,
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
  deviceOrganizationId: string | null;
  deviceVehicleId: string | null;
  prevIgnitionOn: boolean | null;
}

@Injectable()
export class TrackerTcpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackerTcpService.name);
  private server: net.Server | null = null;
  private hexDebugStream: fs.WriteStream | null = null;
  private readonly socketContexts = new Map<net.Socket, SocketContext>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly trackerDevices: TrackerDevicesService,
    private readonly trackerDiscovery: TrackerDiscoveryService,
    private readonly redisWriter: TrackerRedisWriterService,
    private readonly telemetryAlerts: TelemetryAlertsService,
  ) {
    this.logger.log(`Tracker TCP service constructor...`);
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`Tracker TCP server onModuleInit...`);
    const port = parseInt(
      this.config.get<string>("TRACKER_TCP_PORT") ?? "5023",
      10,
    );
    const hexDebugPath = this.config.get<string>("TRACKER_TCP_HEX_DEBUG_FILE")?.trim();
    if (hexDebugPath) {
      this.hexDebugStream = fs.createWriteStream(hexDebugPath, { flags: "a" });
      this.hexDebugStream.on("error", (err: NodeJS.ErrnoException) => {
        this.logger.error(`TCP hex debug file (${hexDebugPath}): ${err.message}`);
      });
      this.logger.warn(
        `TRACKER_TCP_HEX_DEBUG_FILE is set — appending every TCP recv chunk as hex to ${hexDebugPath}`,
      );
    }

    this.server = net.createServer((socket) => this.handleConnection(socket));
    this.server.listen(port, () => {
      this.logger.log(`Tracker TCP server listening on port ${port}`);
    });
    this.server.on("error", (err) => {
      this.logger.error(`Tracker TCP server error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.hexDebugStream) {
      await new Promise<void>((resolve) => {
        this.hexDebugStream!.end(() => resolve());
      });
      this.hexDebugStream = null;
    }
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
      deviceOrganizationId: null,
      deviceVehicleId: null,
      prevIgnitionOn: null,
    };
    this.socketContexts.set(socket, ctx);

    socket.on("data", (data: Buffer) => {
      this.appendTcpHexDebugLine(remote, data);
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

  /** One line per `socket.on("data")` chunk: ISO time, remote, byte length, full hex. */
  private appendTcpHexDebugLine(remote: string, data: Buffer): void {
    const stream = this.hexDebugStream;
    if (!stream) return;
    const line = `${new Date().toISOString()}\t${remote}\t${data.length}\t${data.toString("hex")}\n`;
    stream.write(line, (err) => {
      if (err) {
        this.logger.warn(`TCP hex debug write failed: ${err.message}`);
      }
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
        ctx.deviceOrganizationId = device.organizationId;
        ctx.deviceVehicleId = device.vehicle?.id ?? null;
        ctx.prevIgnitionOn = null;
        this.markConnected(device.id);
        this.logger.log(
          `[GT06] Login | IMEI=${imei} | deviceId=${device.id} | OK (pre-registered)`,
        );
      } else {
        this.logger.log(
          `[GT06] Login | IMEI=${imei} | rejected (device must be pre-registered)`,
        );
        const remote = socket.remoteAddress ?? null;
        void this.trackerDiscovery
          .recordUnknownLogin(imei, remote)
          .catch((err: Error) =>
            this.logger.warn(`Tracker discovery record failed: ${err.message}`),
          );
      }
      return;
    }

    if (isGT06Heartbeat(parsed.protocolNumber)) {
      socket.write(buildGT06HeartbeatAck(parsed.serialNumber, parsed.protocolNumber));
      const status = parseGT06HeartbeatStatus(parsed.content);
      this.logger.log(
        `[GT06] Heartbeat | IMEI=${ctx.imei ?? "—"} | deviceId=${ctx.deviceId ?? "—"} | serial=${parsed.serialNumber} | acc=${status.accOn} volt=${status.voltageLevel} gsm=${status.gsmSignal}`,
      );
      if (ctx.deviceId && ctx.imei) {
        void this.redisWriter.pushStatusOnly(ctx.deviceId, status).catch(() => undefined);
        if (ctx.deviceOrganizationId) {
          void this.processStatusAlerts(ctx, status).catch((err: Error) =>
            this.logger.warn(`Heartbeat alert failed: ${err.message}`),
          );
        }
        void this.persistStatusLog(ctx.deviceId, status).catch(() => undefined);
      }
      return;
    }

    if (isGT06AlarmPacket(parsed.protocolNumber)) {
      socket.write(buildGT06AlarmAck(parsed.serialNumber, parsed.protocolNumber));
      const position = parseGT06AlarmPacket(parsed.content);
      const alarmStr = position?.alarmCode != null ? `alarmCode=${position.alarmCode}` : "no-gps-fix";
      this.logger.log(
        `[GT06] Alarm | IMEI=${ctx.imei ?? "—"} | deviceId=${ctx.deviceId ?? "—"} | serial=${parsed.serialNumber} | ${alarmStr}`,
      );
      if (ctx.deviceId && ctx.imei) {
        if (position) {
          await this.redisWriter.pushPosition(ctx.deviceId, ctx.imei, position);
        }
        if (ctx.deviceOrganizationId) {
          const status = {
            accOn: position?.ignitionOn,
            chargeOn: position?.chargeOn,
            powerCut: position?.powerCut,
            alarmCode: position?.alarmCode,
            voltageLevel: position?.voltageLevel,
            gsmSignal: position?.gsmSignal,
          };
          void this.processStatusAlerts(ctx, status).catch((err: Error) =>
            this.logger.warn(`Alarm alert failed: ${err.message}`),
          );
          if (position?.alarmCode != null && position.alarmCode > 0) {
            void this.telemetryAlerts
              .processDeviceAlarm({
                deviceId: ctx.deviceId,
                organizationId: ctx.deviceOrganizationId,
                vehicleId: ctx.deviceVehicleId,
                alarmCode: position.alarmCode,
              })
              .catch((err: Error) =>
                this.logger.warn(`processDeviceAlarm failed: ${err.message}`),
              );
          }
        }
      }
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
      // Debug: log raw bytes after the standard 18-byte GPS block to detect extended fields (e.g. odometer)
      if (parsed.content.length > 18) {
        const extra = parsed.content.subarray(18);
        this.logger.debug(
          `[GT06] Location extra bytes (proto=0x${parsed.protocolNumber.toString(16).padStart(2,'0')}) ` +
          `after GPS block: ${extra.length}B = ${extra.toString('hex')} | ` +
          `full content (${parsed.content.length}B): ${parsed.content.toString('hex')}`,
        );
      }
      if (position && ctx.deviceId && ctx.imei) {
        await this.redisWriter.pushPosition(ctx.deviceId, ctx.imei, position);
        const orgId = ctx.deviceOrganizationId;
        if (orgId) {
          const currentIgnition = extractIgnitionFromPosition(position);
          void this.telemetryAlerts
            .processPosition({
              deviceId: ctx.deviceId,
              organizationId: orgId,
              vehicleId: ctx.deviceVehicleId,
              position,
              prevIgnitionOn: ctx.prevIgnitionOn ?? undefined,
              currentIgnitionOn: currentIgnition ?? undefined,
            })
            .catch((err: Error) =>
              this.logger.warn(`Alert processing failed: ${err.message}`),
            );
          if (currentIgnition !== null && currentIgnition !== undefined) {
            ctx.prevIgnitionOn = currentIgnition;
          }
        }
      }
    }
  }

  private async processStatusAlerts(
    ctx: SocketContext,
    status: {
      accOn?: boolean;
      chargeOn?: boolean;
      powerCut?: boolean;
      alarmCode?: number;
      voltageLevel?: number;
      gsmSignal?: number;
    },
  ): Promise<void> {
    if (!ctx.deviceId || !ctx.deviceOrganizationId) return;

    // Ignition change detection via status-only events
    if (status.accOn != null && status.accOn !== ctx.prevIgnitionOn) {
      ctx.prevIgnitionOn = status.accOn;
    }

    // Low battery: voltageLevel 0 = power cut, 1 = very low
    if (status.voltageLevel != null && status.voltageLevel <= 1 && !status.powerCut) {
      void this.telemetryAlerts
        .processDeviceAlarm({
          deviceId: ctx.deviceId,
          organizationId: ctx.deviceOrganizationId,
          vehicleId: ctx.deviceVehicleId,
          alarmCode: 0x10, // synthetic: low battery
        })
        .catch(() => undefined);
    }
  }

  private async persistStatusLog(
    deviceId: string,
    status: {
      accOn?: boolean;
      chargeOn?: boolean;
      powerCut?: boolean;
      alarmCode?: number;
      voltageLevel?: number;
      gsmSignal?: number;
    },
  ): Promise<void> {
    await this.prisma.deviceStatusLog.create({
      data: {
        deviceId,
        ignitionOn: status.accOn,
        chargeOn: status.chargeOn,
        powerCut: status.powerCut,
        alarmCode: status.alarmCode,
        voltageLevel: status.voltageLevel,
        gsmSignal: status.gsmSignal,
      },
    });
  }
}

function extractIgnitionFromPosition(position: NormalizedPosition): boolean | null {
  return position.ignitionOn ?? null;
}

import { Injectable, Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import type { RedisClientType } from "redis";
import { PrismaService } from "@/prisma/prisma.service";
import { TRACKER_REDIS } from "./tracker-redis-writer.service";

const CONSUMER_GROUP = "tracker-persist";
const CONSUMER_NAME = "cron-worker";
const BATCH_SIZE = 2000;
const CHUNK_SIZE = 200;

/** Parse XREADGROUP reply: [[streamKey, [[id, [f1,v1,f2,v2,...]], ...]]] */
function parseStreamReply(reply: unknown): Array<{ id: string; message: Record<string, string> }> {
  const out: Array<{ id: string; message: Record<string, string> }> = [];
  if (!Array.isArray(reply) || reply.length === 0) return out;
  const [, streamMessages] = reply[0] as [string, Array<[string, string[]]>];
  if (!Array.isArray(streamMessages)) return out;
  for (const [id, flatFields] of streamMessages) {
    const message: Record<string, string> = {};
    for (let i = 0; i < flatFields.length - 1; i += 2) {
      message[flatFields[i] as string] = flatFields[i + 1] as string;
    }
    out.push({ id, message });
  }
  return out;
}

@Injectable()
export class TrackerPersistCronService {
  private readonly logger = new Logger(TrackerPersistCronService.name);
  private readonly streamKey: string;
  private groupCreated = false;

  constructor(
    @Inject(TRACKER_REDIS) private readonly redis: RedisClientType,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.streamKey =
      this.config.get<string>("TRACKER_REDIS_STREAM_KEY") ?? "tracker:positions";
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.sendCommand([
        "XGROUP",
        "CREATE",
        this.streamKey,
        CONSUMER_GROUP,
        "0",
        "MKSTREAM",
      ]);
      this.groupCreated = true;
      this.logger.log(
        `Consumer group ${CONSUMER_GROUP} ensured for ${this.streamKey}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("BUSYGROUP")) {
        this.groupCreated = true;
      } else {
        this.logger.warn(`Could not create consumer group: ${msg}`);
      }
    }
  }

  /**
   * Cron: every 5 seconds, read batch from Redis stream and persist to Postgres.
   */
  @Cron("*/5 * * * * *")
  async persistBatch(): Promise<void> {
    if (!this.groupCreated) return;

    try {
      this.logger.log(`Reading up to ${BATCH_SIZE} messages from stream ${this.streamKey}`);
      const reply = await this.redis.sendCommand([
        "XREADGROUP",
        "GROUP",
        CONSUMER_GROUP,
        CONSUMER_NAME,
        "COUNT",
        String(BATCH_SIZE),
        "STREAMS",
        this.streamKey,
        ">",
      ]);

      const messages = parseStreamReply(reply);
      if (messages.length === 0) {
        this.logger.debug("No pending messages in stream");
        return;
      }
      this.logger.log(`Read ${messages.length} messages from stream`);

      const rows: Array<{
        deviceId: string;
        latitude: number;
        longitude: number;
        altitude?: number;
        speed?: number;
        heading?: number;
        recordedAt: Date;
        ignitionOn?: boolean;
        voltageLevel?: number;
        gsmSignal?: number;
        alarmCode?: number;
        chargeOn?: boolean;
        powerCut?: boolean;
        lbsMcc?: number;
        lbsMnc?: number;
        lbsLac?: number;
        lbsCellId?: number;
        receivedAt?: Date;
        odometerKm?: number;
        city?: string;
      }> = [];
      const idsToAck: string[] = [];

      for (const { id, message } of messages) {
        const {
          deviceId,
          latitude,
          longitude,
          altitude,
          speed,
          heading,
          recordedAt,
          ignitionOn,
          voltageLevel,
          gsmSignal,
          alarmCode,
          chargeOn,
          powerCut,
          lbsMcc,
          lbsMnc,
          lbsLac,
          lbsCellId,
          receivedAt,
          odometerKm,
          city,
        } = message;
        if (!deviceId || !latitude || !longitude || !recordedAt) {
          this.logger.warn(
            `Skipping invalid message id=${id}: missing required fields (deviceId=${!!deviceId}, lat=${!!latitude}, lng=${!!longitude}, recordedAt=${!!recordedAt})`,
          );
          idsToAck.push(id);
          continue;
        }
        rows.push({
          deviceId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          altitude: altitude ? parseFloat(altitude) : undefined,
          speed: speed ? parseFloat(speed) : undefined,
          heading: heading ? parseFloat(heading) : undefined,
          recordedAt: new Date(recordedAt),
          ignitionOn: ignitionOn === "true" ? true : ignitionOn === "false" ? false : undefined,
          voltageLevel: voltageLevel ? parseInt(voltageLevel, 10) : undefined,
          gsmSignal: gsmSignal ? parseInt(gsmSignal, 10) : undefined,
          alarmCode: alarmCode ? parseInt(alarmCode, 10) : undefined,
          chargeOn: chargeOn === "true" ? true : chargeOn === "false" ? false : undefined,
          powerCut: powerCut === "true" ? true : powerCut === "false" ? false : undefined,
          lbsMcc: lbsMcc ? parseInt(lbsMcc, 10) : undefined,
          lbsMnc: lbsMnc ? parseInt(lbsMnc, 10) : undefined,
          lbsLac: lbsLac ? parseInt(lbsLac, 10) : undefined,
          lbsCellId: lbsCellId ? parseInt(lbsCellId, 10) : undefined,
          receivedAt: receivedAt ? new Date(receivedAt) : undefined,
          odometerKm: odometerKm ? parseFloat(odometerKm) : undefined,
          city: city || undefined,
        });
        idsToAck.push(id);
      }

      const chunkCount = Math.ceil(rows.length / CHUNK_SIZE);
      this.logger.debug(`Persisting ${rows.length} positions in ${chunkCount} chunk(s)`);
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        await this.prisma.devicePosition.createMany({
          data: chunk,
          skipDuplicates: true,
        });
      }

      if (idsToAck.length > 0) {
        await this.redis.sendCommand([
          "XACK",
          this.streamKey,
          CONSUMER_GROUP,
          ...idsToAck,
        ]);
        this.logger.debug(`Acked ${idsToAck.length} message(s) in stream`);
      }

      this.logger.log(`Persisted ${rows.length} positions to Postgres (acked ${idsToAck.length} messages)`);
    } catch (err) {
      this.logger.error(
        `Persist batch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

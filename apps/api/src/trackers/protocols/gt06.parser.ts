/**
 * GT06 (x12-GT06) binary protocol parser.
 * Packet: start 2B | length 1B | protocol 1B | content | serial 2B | crc 2B | stop 2B (0x0D 0x0A)
 * Start: 0x78 0x78 or 0x79 0x79
 */

import { NormalizedPosition } from "../dto/index";

const START_1 = 0x78;
const START_2 = 0x79;
const STOP = [0x0d, 0x0a];
const PROTOCOL_LOGIN = 0x01;
const PROTOCOL_LOCATION_2G = 0x22;
const PROTOCOL_LOCATION_4G = 0xa0;
const PROTOCOL_HEARTBEAT = 0x36;

export function isGT06Packet(buffer: Buffer): boolean {
  if (buffer.length < 10) return false;
  const a = buffer[0];
  const b = buffer[1];
  return (
    (a === START_1 && b === START_1) || (a === START_1 && b === START_2)
  );
}

export function getGT06PacketLength(buffer: Buffer): number | null {
  if (buffer.length < 4) return null;
  const len = buffer[2];
  const contentLen = len - 5;
  if (contentLen < 0) return null;
  const total = 2 + 1 + 1 + contentLen + 2 + 2 + 2;
  return total;
}

export function tryParseGT06Packet(
  buffer: Buffer,
): {
  protocolNumber: number;
  content: Buffer;
  serialNumber: number;
  fullLength: number;
} | null {
  if (buffer.length < 10) return null;
  if (!isGT06Packet(buffer)) return null;
  const len = buffer[2];
  const protocolNumber = buffer[3];
  const contentLen = len - 5;
  if (contentLen < 0) return null;
  const total = 2 + 1 + 1 + contentLen + 2 + 2 + 2;
  if (buffer.length < total) return null;
  const stopOk =
    buffer[total - 2] === STOP[0] && buffer[total - 1] === STOP[1];
  if (!stopOk) return null;
  const crcStart = 2;
  const crcEnd = total - 4;
  const crcComputed = crc16(buffer.subarray(crcStart, crcEnd));
  const crcReceived = buffer.readUInt16BE(total - 4);
  if (crcComputed !== crcReceived) return null;
  const content = buffer.subarray(4, 4 + contentLen);
  const serialNumber = buffer.readUInt16BE(4 + contentLen);
  return {
    protocolNumber,
    content,
    serialNumber,
    fullLength: total,
  };
}

function crc16(data: Buffer): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) !== 0) {
        crc = (crc >>> 1) ^ 0xa001;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return crc & 0xffff;
}

export function isGT06Login(protocolNumber: number): boolean {
  return protocolNumber === PROTOCOL_LOGIN;
}

export function isGT06Location(protocolNumber: number): boolean {
  return (
    protocolNumber === PROTOCOL_LOCATION_2G ||
    protocolNumber === PROTOCOL_LOCATION_4G
  );
}

export function isGT06Heartbeat(protocolNumber: number): boolean {
  return protocolNumber === PROTOCOL_HEARTBEAT;
}

/** Extract 15-digit IMEI from login packet content (8 bytes terminal ID as BCD). */
export function getImeiFromGT06Login(content: Buffer): string | null {
  if (content.length < 8) return null;
  let imei = "";
  for (let i = 0; i < 8; i++) {
    const b = content[i];
    const high = (b >> 4) & 0x0f;
    const low = b & 0x0f;
    if (i === 0 && high === 0) {
      imei += String(low);
    } else {
      imei += String(high) + String(low);
    }
  }
  return imei.length >= 15 ? imei.slice(0, 15) : imei;
}

/**
 * Parse GT06 location content (0x22 or 0xa0) to normalized position.
 * Common format: 6B date BCD (YYMMDDHHmmss), 1B satellites, 4B lat, 4B lng, 1B speed, 2B course/course.
 */
export function getPositionFromGT06Location(
  content: Buffer,
): NormalizedPosition | null {
  if (content.length < 18) return null;
  const year = 2000 + ((content[0] >> 4) * 10 + (content[0] & 0x0f));
  const month = (content[1] >> 4) * 10 + (content[1] & 0x0f);
  const day = (content[2] >> 4) * 10 + (content[2] & 0x0f);
  const hour = (content[3] >> 4) * 10 + (content[3] & 0x0f);
  const min = (content[4] >> 4) * 10 + (content[4] & 0x0f);
  const sec = (content[5] >> 4) * 10 + (content[5] & 0x0f);
  const recordedAt = new Date(
    Date.UTC(year, month - 1, day, hour, min, sec),
  ).toISOString();
  const latRaw = content.readInt32BE(7);
  const lngRaw = content.readInt32BE(11);
  const latitude = latRaw / 30000;
  const longitude = lngRaw / 30000;
  const speed = content[15] ?? 0;
  const heading = content.readUInt16BE(16) ?? 0;
  return {
    latitude,
    longitude,
    recordedAt,
    speed: speed * 1.852,
    heading: heading > 0 && heading < 360 ? heading : undefined,
  };
}

/** Build login ACK packet (same serial, protocol 0x01 response). */
export function buildGT06LoginAck(serialNumber: number): Buffer {
  const content = Buffer.alloc(4);
  content.writeUInt16BE(serialNumber, 0);
  content.writeUInt16BE(0x00, 2);
  return buildGT06Response(PROTOCOL_LOGIN, content, serialNumber);
}

/** Build heartbeat ACK. */
export function buildGT06HeartbeatAck(serialNumber: number): Buffer {
  const content = Buffer.alloc(4);
  content.writeUInt16BE(serialNumber, 0);
  content.writeUInt16BE(0x00, 2);
  return buildGT06Response(PROTOCOL_HEARTBEAT, content, serialNumber);
}

/** Build location ACK (device may expect this). */
export function buildGT06LocationAck(serialNumber: number): Buffer {
  const content = Buffer.alloc(4);
  content.writeUInt16BE(serialNumber, 0);
  content.writeUInt16BE(0x00, 2);
  return buildGT06Response(PROTOCOL_LOCATION_2G, content, serialNumber);
}

function buildGT06Response(
  protocolNumber: number,
  content: Buffer,
  serialNumber: number,
): Buffer {
  const len = 1 + content.length + 2 + 2;
  const buf = Buffer.alloc(2 + 1 + 1 + content.length + 2 + 2 + 2);
  let off = 0;
  buf[off++] = START_1;
  buf[off++] = START_1;
  buf[off++] = len;
  buf[off++] = protocolNumber;
  content.copy(buf, off);
  off += content.length;
  buf.writeUInt16BE(serialNumber, off);
  off += 2;
  const crc = crc16(buf.subarray(2, off));
  buf.writeUInt16BE(crc, off);
  off += 2;
  buf[off++] = STOP[0];
  buf[off++] = STOP[1];
  return buf;
}

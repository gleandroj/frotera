/**
 * GT06 protocol packet builders.
 * Packet format: start 2B | length 1B | protocol 1B | content | serial 2B | crc 2B | stop 2B
 */

const START = 0x78;
const STOP: [number, number] = [0x0d, 0x0a];
const PROTOCOL_LOGIN = 0x01;
const PROTOCOL_HEARTBEAT = 0x36;
const PROTOCOL_LOCATION = 0x22;

function crc16(data: Buffer): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc & 0xffff;
}

function imeiToBcd(imei: string): Buffer {
  const digits = imei.replace(/\D/g, "").slice(0, 15).padStart(16, "0");
  const buf = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    const high = parseInt(digits[i * 2], 10);
    const low = parseInt(digits[i * 2 + 1], 10);
    buf[i] = (high << 4) | low;
  }
  return buf;
}

function writePacket(
  protocolNumber: number,
  content: Buffer,
  serial: number,
): Buffer {
  const len = 1 + content.length + 2 + 2;
  const buf = Buffer.alloc(2 + 1 + 1 + content.length + 2 + 2 + 2);
  let off = 0;
  buf[off++] = START;
  buf[off++] = START;
  buf[off++] = len;
  buf[off++] = protocolNumber;
  content.copy(buf, off);
  off += content.length;
  buf.writeUInt16BE(serial, off);
  off += 2;
  buf.writeUInt16BE(crc16(buf.subarray(2, off)), off);
  off += 2;
  buf[off++] = STOP[0];
  buf[off++] = STOP[1];
  return buf;
}

export function buildLoginPacket(imei: string, serial = 1): Buffer {
  const content = imeiToBcd(imei);
  return writePacket(PROTOCOL_LOGIN, content, serial);
}

export function buildHeartbeatPacket(serial: number): Buffer {
  const content = Buffer.alloc(4);
  return writePacket(PROTOCOL_HEARTBEAT, content, serial);
}

export function buildLocationPacket(
  lat: number,
  lng: number,
  date: Date,
  serial: number,
  speedKmh = 0,
  headingDeg = 0,
): Buffer {
  const content = Buffer.alloc(18);
  let off = 0;
  content[off++] = ((date.getUTCFullYear() % 100) / 10) << 4 | (date.getUTCFullYear() % 10);
  content[off++] = ((date.getUTCMonth() + 1) / 10) << 4 | ((date.getUTCMonth() + 1) % 10);
  content[off++] = (date.getUTCDate() / 10) << 4 | (date.getUTCDate() % 10);
  content[off++] = (date.getUTCHours() / 10) << 4 | (date.getUTCHours() % 10);
  content[off++] = (date.getUTCMinutes() / 10) << 4 | (date.getUTCMinutes() % 10);
  content[off++] = (date.getUTCSeconds() / 10) << 4 | (date.getUTCSeconds() % 10);
  content[off++] = 8;
  content.writeInt32BE(Math.round(lat * 30000), 7);
  content.writeInt32BE(Math.round(lng * 30000), 11);
  const speedKnots = Math.min(255, Math.round(speedKmh / 1.852));
  content[15] = speedKnots;
  const heading = Math.min(359, Math.max(0, Math.round(headingDeg)));
  content.writeUInt16BE(heading, 16);
  return writePacket(PROTOCOL_LOCATION, content, serial);
}

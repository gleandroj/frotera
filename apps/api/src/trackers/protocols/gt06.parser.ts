/**
 * GT06 (X3Tech / Concox) binary protocol parser.
 * Short frame: 78 78 | LEN(1B) | PROTOCOL(1B) | CONTENT | SERIAL(2B) | CRC(2B) | 0D 0A
 * Extended (4G): 79 79 | LEN(2B BE) | PROTOCOL(1B) | CONTENT | SERIAL(2B) | CRC(2B) | 0D 0A
 * CRC: CRC-16 CCITT (ITU), negated. ACK with same protocol + serial for Login, Heartbeat, Location.
 */

import { NormalizedPosition } from "../dto/index";

const START_1 = 0x78;
const START_2 = 0x79;
const STOP = [0x0d, 0x0a];

const PROTOCOL_LOGIN = 0x01;
const PROTOCOL_LOCATION_STD = 0x12;   // GPS standard (divisor 1_800_000, bits 12/11/10)
const PROTOCOL_LOCATION_2G = 0x22;
const PROTOCOL_LOCATION_4G = 0xa0;
const PROTOCOL_LOCATION_ADVANCED = 0x94; // GPS + LBS + status
const PROTOCOL_LOCATION_ON_DEMAND = 0x1a; // trigger via SMS, response via TCP
const PROTOCOL_HEARTBEAT = 0x36;
const PROTOCOL_HEARTBEAT_OLD = 0x13;
const PROTOCOL_ALARM = 0x16;          // GPS + LBS + alarm status

export function isGT06Packet(buffer: Buffer): boolean {
  if (buffer.length < 10) return false;
  const a = buffer[0];
  const b = buffer[1];
  return (
    (a === START_1 && b === START_1) ||
    (a === START_2 && b === START_2)
  );
}

/** Short frame 78 78: LEN 1 byte. Extended frame 79 79: LEN 2 bytes BE. */
export function getGT06PacketLength(buffer: Buffer): number | null {
  if (buffer.length < 4) return null;
  const isExtended = buffer[0] === START_2 && buffer[1] === START_2;
  let len: number;
  if (isExtended) {
    if (buffer.length < 5) return null;
    len = buffer.readUInt16BE(2);
  } else {
    len = buffer[2];
  }
  const contentLen = len - 5;
  if (contentLen < 0) return null;
  const headerLen = isExtended ? 4 : 3; // start(2) + len(1 or 2)
  const total = headerLen + 1 + contentLen + 2 + 2 + 2;
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
  const isExtended = buffer[0] === START_2 && buffer[1] === START_2;
  const len = isExtended ? buffer.readUInt16BE(2) : buffer[2];
  const headerLen = isExtended ? 4 : 3;
  const protocolNumber = buffer[headerLen];
  const contentLen = len - 5;
  if (contentLen < 0) return null;
  const total = headerLen + 1 + contentLen + 2 + 2 + 2;
  if (buffer.length < total) return null;
  const stopOk =
    buffer[total - 2] === STOP[0] && buffer[total - 1] === STOP[1];
  if (!stopOk) return null;
  const crcStart = 2;
  const crcEnd = total - 4;
  const crcComputed = crc16Itu(buffer.subarray(crcStart, crcEnd));
  const crcReceived = buffer.readUInt16BE(total - 4);
  if (crcComputed !== crcReceived) return null;
  const content = buffer.subarray(headerLen + 1, headerLen + 1 + contentLen);
  const serialNumber = buffer.readUInt16BE(headerLen + 1 + contentLen);
  return {
    protocolNumber,
    content,
    serialNumber,
    fullLength: total,
  };
}

/**
 * CRC-ITU (CRC-16-CCITT) as used by GT06/Concox protocol.
 * Checksum is computed over payload (from length byte through serial) and NEGATED.
 * See e.g. GT06 protocol docs / RFC1331 Appendix B.
 */
const CRC_ITU_TABLE = new Uint16Array([
  0x0000, 0x1189, 0x2312, 0x329b, 0x4624, 0x57ad, 0x6536, 0x74bf,
  0x8c48, 0x9dc1, 0xaf5a, 0xbed3, 0xca6c, 0xdbe5, 0xe97e, 0xf8f7,
  0x1081, 0x0108, 0x3393, 0x221a, 0x56a5, 0x472c, 0x75b7, 0x643e,
  0x9cc9, 0x8d40, 0xbfdb, 0xae52, 0xdaed, 0xcb64, 0xf9ff, 0xe876,
  0x2102, 0x308b, 0x0210, 0x1399, 0x6726, 0x76af, 0x4434, 0x55bd,
  0xad4a, 0xbcc3, 0x8e58, 0x9fd1, 0xeb6e, 0xfae7, 0xc87c, 0xd9f5,
  0x3183, 0x200a, 0x1291, 0x0318, 0x77a7, 0x662e, 0x54b5, 0x453c,
  0xbdcb, 0xac42, 0x9ed9, 0x8f50, 0xfbef, 0xea66, 0xd8fd, 0xc974,
  0x4204, 0x538d, 0x6116, 0x709f, 0x0420, 0x15a9, 0x2732, 0x36bb,
  0xce4c, 0xdfc5, 0xed5e, 0xfcd7, 0x8868, 0x99e1, 0xab7a, 0xbaf3,
  0x5285, 0x430c, 0x7197, 0x601e, 0x14a1, 0x0528, 0x37b3, 0x263a,
  0xdecd, 0xcf44, 0xfddf, 0xec56, 0x98e9, 0x8960, 0xbbfb, 0xaa72,
  0x6306, 0x728f, 0x4014, 0x519d, 0x2522, 0x34ab, 0x0630, 0x17b9,
  0xef4e, 0xfec7, 0xcc5c, 0xddd5, 0xa96a, 0xb8e3, 0x8a78, 0x9bf1,
  0x7387, 0x620e, 0x5095, 0x411c, 0x35a3, 0x242a, 0x16b1, 0x0738,
  0xffcf, 0xee46, 0xdcdd, 0xcd54, 0xb9eb, 0xa862, 0x9af9, 0x8b70,
  0x8408, 0x9581, 0xa71a, 0xb693, 0xc22c, 0xd3a5, 0xe13e, 0xf0b7,
  0x0840, 0x19c9, 0x2b52, 0x3adb, 0x4e64, 0x5fed, 0x6d76, 0x7cff,
  0x9489, 0x8500, 0xb79b, 0xa612, 0xd2ad, 0xc324, 0xf1bf, 0xe036,
  0x18c1, 0x0948, 0x3bd3, 0x2a5a, 0x5ee5, 0x4f6c, 0x7df7, 0x6c7e,
  0xa50a, 0xb483, 0x8618, 0x9791, 0xe32e, 0xf2a7, 0xc03c, 0xd1b5,
  0x2942, 0x38cb, 0x0a50, 0x1bd9, 0x6f66, 0x7eef, 0x4c74, 0x5dfd,
  0xb58b, 0xa402, 0x9699, 0x8710, 0xf3af, 0xe226, 0xd0bd, 0xc134,
  0x39c3, 0x284a, 0x1ad1, 0x0b58, 0x7fe7, 0x6e6e, 0x5cf5, 0x4d7c,
  0xc60c, 0xd785, 0xe51e, 0xf497, 0x8028, 0x91a1, 0xa33a, 0xb2b3,
  0x4a44, 0x5bcd, 0x6956, 0x78df, 0x0c60, 0x1de9, 0x2f72, 0x3efb,
  0xd68d, 0xc704, 0xf59f, 0xe416, 0x90a9, 0x8120, 0xb3bb, 0xa232,
  0x5ac5, 0x4b4c, 0x79d7, 0x685e, 0x1ce1, 0x0d68, 0x3ff3, 0x2e7a,
  0xe70e, 0xf687, 0xc41c, 0xd595, 0xa12a, 0xb0a3, 0x8238, 0x93b1,
  0x6b46, 0x7acf, 0x4854, 0x59dd, 0x2d62, 0x3ceb, 0x0e70, 0x1ff9,
  0xf78f, 0xe606, 0xd49d, 0xc514, 0xb1ab, 0xa022, 0x92b9, 0x8330,
  0x7bc7, 0x6a4e, 0x58d5, 0x495c, 0x3de3, 0x2c6a, 0x1ef1, 0x0f78,
]);

function crc16Itu(data: Buffer): number {
  let fcs = 0xffff;
  for (let i = 0; i < data.length; i++) {
    fcs = (fcs >>> 8) ^ CRC_ITU_TABLE[(fcs ^ data[i]) & 0xff];
  }
  return (~fcs) & 0xffff;
}

export function isGT06Login(protocolNumber: number): boolean {
  return protocolNumber === PROTOCOL_LOGIN;
}

export function isGT06Location(protocolNumber: number): boolean {
  return (
    protocolNumber === PROTOCOL_LOCATION_STD ||
    protocolNumber === PROTOCOL_LOCATION_2G ||
    protocolNumber === PROTOCOL_LOCATION_4G ||
    protocolNumber === PROTOCOL_LOCATION_ADVANCED ||
    protocolNumber === PROTOCOL_LOCATION_ON_DEMAND
  );
}

export function isGT06AlarmPacket(protocolNumber: number): boolean {
  return protocolNumber === PROTOCOL_ALARM;
}

export function isGT06Heartbeat(protocolNumber: number): boolean {
  return (
    protocolNumber === PROTOCOL_HEARTBEAT ||
    protocolNumber === PROTOCOL_HEARTBEAT_OLD
  );
}

/** Human-readable name for GT06 protocol number (for logging). */
export function getGT06ProtocolName(protocolNumber: number): string {
  switch (protocolNumber) {
    case PROTOCOL_LOGIN:
      return "Login";
    case PROTOCOL_LOCATION_STD:
      return "Location (0x12 std)";
    case PROTOCOL_LOCATION_2G:
      return "Location (2G)";
    case PROTOCOL_LOCATION_4G:
      return "Location (4G)";
    case PROTOCOL_LOCATION_ADVANCED:
      return "Location (Advanced 0x94)";
    case PROTOCOL_LOCATION_ON_DEMAND:
      return "Location (on demand 0x1A)";
    case PROTOCOL_HEARTBEAT:
      return "Heartbeat";
    case PROTOCOL_HEARTBEAT_OLD:
      return "Heartbeat (0x13)";
    case PROTOCOL_ALARM:
      return "Alarm (0x16)";
    default:
      return `Unknown (0x${protocolNumber.toString(16).padStart(2, "0")})`;
  }
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
 * Find start offset of the 18-byte GPS block (YYMMDDHHmmss BCD) in extended 0x22 frames.
 * Some firmwares send [terminal][base time][GPS time][GPS block][LBS][status]; this locates the GPS block.
 * Also used for 0x1A (on-demand) where layout is variable (ASCII/phone before or after GPS block).
 */
export function findGpsOffset(buf: Buffer): number | null {
  for (let i = 0; i <= buf.length - 18; i++) {
    const yy = buf[i];
    const mm = buf[i + 1];
    if (yy >= 0x20 && yy <= 0x30 && mm >= 0x01 && mm <= 0x12) {
      return i;
    }
  }
  return null;
}

/**
 * Parse 1-byte GT06 terminal information field.
 * Bit 6 (0x40) = ACC/ignition on, bit 5 (0x20) = charge on, bits 2-0 = alarm type
 * (0=normal, 1=SOS, 2=power cut, 3=shock/vibration).
 */
export function parseGT06TerminalInfo(b: number): {
  accOn: boolean;
  chargeOn: boolean;
  powerCut: boolean;
  alarmCode: number;
} {
  const alarmCode = b & 0x07;
  return {
    accOn: (b & 0x40) !== 0,
    chargeOn: (b & 0x20) !== 0,
    powerCut: alarmCode === 2,
    alarmCode,
  };
}

/**
 * Parse GT06 standard location packet (0x12).
 * Same 18-byte GPS block layout as 0x22, but:
 *   - Divisor 1_800_000 instead of 300_000
 *   - Bit 12 = GPS fix, bit 11 = lat south, bit 10 = lng west
 */
export function getPositionFromGT06LocationStd(
  content: Buffer,
): NormalizedPosition | null {
  if (content.length < 18) return null;

  const year = 2000 + ((content[0] >> 4) * 10 + (content[0] & 0x0f));
  const month = (content[1] >> 4) * 10 + (content[1] & 0x0f);
  const day = (content[2] >> 4) * 10 + (content[2] & 0x0f);
  const hour = (content[3] >> 4) * 10 + (content[3] & 0x0f);
  const min = (content[4] >> 4) * 10 + (content[4] & 0x0f);
  const sec = (content[5] >> 4) * 10 + (content[5] & 0x0f);
  const recordedAt = new Date(Date.UTC(year, month - 1, day, hour, min, sec)).toISOString();

  let lat = content.readInt32BE(7) / 1_800_000;
  let lng = content.readInt32BE(11) / 1_800_000;
  const speed = (content[15] ?? 0) * 1.852;
  const courseStatus = content.readUInt16BE(16);

  const gpsFixed = (courseStatus & 0x1000) !== 0;  // bit 12
  const latSouth = (courseStatus & 0x0800) !== 0;  // bit 11
  const lngWest  = (courseStatus & 0x0400) !== 0;  // bit 10
  const course   = courseStatus & 0x03ff;

  if (latSouth) lat = -lat;
  if (lngWest)  lng = -lng;

  if (!gpsFixed) return null;

  return { latitude: lat, longitude: lng, speed, heading: course, recordedAt };
}

/**
 * Parse GT06 heartbeat status (0x13 old heartbeat), content is typically 5 bytes.
 * Byte 0: terminal info, byte 1: voltage level, byte 2: GSM signal.
 * Returns status fields without a position (no GPS in heartbeat).
 */
export function parseGT06HeartbeatStatus(content: Buffer): {
  accOn?: boolean;
  chargeOn?: boolean;
  powerCut?: boolean;
  alarmCode?: number;
  voltageLevel?: number;
  gsmSignal?: number;
} {
  if (content.length < 1) return {};
  const { accOn, chargeOn, powerCut, alarmCode } = parseGT06TerminalInfo(content[0]);
  const voltageLevel = content.length >= 2 ? content[1] : undefined;
  const gsmSignal = content.length >= 3 ? content[2] : undefined;
  return { accOn, chargeOn, powerCut, alarmCode, voltageLevel, gsmSignal };
}

/**
 * Parse GT06 alarm packet (0x16): GPS block + LBS section + status bytes.
 * Layout: 18B GPS | 1B LBS-len | [LBS data] | terminal-info | voltage | GSM
 * statusOffset = 18 + content[18] (LBS section total length covers its own length byte).
 */
export function parseGT06AlarmPacket(content: Buffer): NormalizedPosition | null {
  if (content.length < 19) return null;

  const year = 2000 + ((content[0] >> 4) * 10 + (content[0] & 0x0f));
  const month = (content[1] >> 4) * 10 + (content[1] & 0x0f);
  const day = (content[2] >> 4) * 10 + (content[2] & 0x0f);
  const hour = (content[3] >> 4) * 10 + (content[3] & 0x0f);
  const min = (content[4] >> 4) * 10 + (content[4] & 0x0f);
  const sec = (content[5] >> 4) * 10 + (content[5] & 0x0f);
  const recordedAt = new Date(Date.UTC(year, month - 1, day, hour, min, sec)).toISOString();

  let lat = content.readInt32BE(7) / 300_000;
  let lng = content.readInt32BE(11) / 300_000;
  const speed = (content[15] ?? 0) * 1.852;
  const courseStatus = content.readUInt16BE(16);

  const gpsFixed = (courseStatus & 0x8000) !== 0;
  const latSouth = (courseStatus & 0x4000) !== 0;
  const lngWest  = (courseStatus & 0x2000) !== 0;
  const course   = courseStatus & 0x03ff;

  if (latSouth) lat = -lat;
  if (lngWest)  lng = -lng;

  const lbsLen = content[18];
  const statusOffset = 18 + lbsLen;

  // Parse LBS cell info when present (MCC 2B, MNC 1B, LAC 2B, CellID 2B = 7 bytes min)
  let lbsMcc: number | undefined;
  let lbsMnc: number | undefined;
  let lbsLac: number | undefined;
  let lbsCellId: number | undefined;
  if (lbsLen >= 8 && content.length >= 19 + 7) {
    lbsMcc    = content.readUInt16BE(19);
    lbsMnc    = content[21];
    lbsLac    = content.readUInt16BE(22);
    lbsCellId = content.readUInt16BE(24);
  }

  let accOn: boolean | undefined;
  let chargeOn: boolean | undefined;
  let powerCut: boolean | undefined;
  let alarmCode: number | undefined;
  let voltageLevel: number | undefined;
  let gsmSignal: number | undefined;

  if (content.length > statusOffset) {
    const info = parseGT06TerminalInfo(content[statusOffset]);
    accOn = info.accOn;
    chargeOn = info.chargeOn;
    powerCut = info.powerCut;
    alarmCode = info.alarmCode;
  }
  if (content.length > statusOffset + 1) voltageLevel = content[statusOffset + 1];
  if (content.length > statusOffset + 2) gsmSignal    = content[statusOffset + 2];

  // Accept alarm packets even without GPS fix (alarm is still meaningful)
  if (!gpsFixed) return null;

  return {
    latitude: lat,
    longitude: lng,
    speed,
    heading: course,
    recordedAt,
    ignitionOn: accOn,
    chargeOn,
    powerCut,
    alarmCode,
    voltageLevel,
    gsmSignal,
    lbsMcc,
    lbsMnc,
    lbsLac,
    lbsCellId,
  };
}

/**
 * Convert NMEA DDMM.MMMMM (or DDDMM.MMMMM for longitude) to decimal degrees.
 * value = degrees * 100 + minutes (e.g. 5506.12236 → 55° 06.12236' → 55 + 6.12236/60).
 * negate: true for South latitude or West longitude.
 */
export function nmeaDdmmToDecimal(value: number, negate: boolean): number {
  const deg = Math.floor(value / 100);
  const min = value - deg * 100;
  let decimal = deg + min / 60;
  return negate ? -decimal : decimal;
}

/**
 * Parse GT06 location content (0x22 Location 2G, 0xA0 4G) to normalized position.
 * Format at startOffset: 6B date BCD (YYMMDDHHmmss), 1B satellites, 4B latitude, 4B longitude, 1B speed, 2B course/status.
 * GT06 order: LATITUDE at startOffset+7, LONGITUDE at startOffset+11. Divisor 300000 (X3Tech/Concox).
 * course/status: bit15=GPS fix, bit14=lat south, bit13=lng west, bits0-9=course.
 * For long 0x22 (e.g. 65 bytes), use findGpsOffset(content) and pass result as startOffset.
 * For 0x1A (on-demand), some firmwares do not set the GPS fix bit; pass requireGpsFix: false.
 */
export function getPositionFromGT06Location(
  content: Buffer,
  startOffset: number = 0,
  requireGpsFix: boolean = true,
): NormalizedPosition | null {
  if (content.length < startOffset + 18) return null;

  const o = startOffset;
  const year = 2000 + ((content[o + 0] >> 4) * 10 + (content[o + 0] & 0x0f));
  const month = (content[o + 1] >> 4) * 10 + (content[o + 1] & 0x0f);
  const day = (content[o + 2] >> 4) * 10 + (content[o + 2] & 0x0f);
  const hour = (content[o + 3] >> 4) * 10 + (content[o + 3] & 0x0f);
  const min = (content[o + 4] >> 4) * 10 + (content[o + 4] & 0x0f);
  const sec = (content[o + 5] >> 4) * 10 + (content[o + 5] & 0x0f);

  const recordedAt = new Date(
    Date.UTC(year, month - 1, day, hour, min, sec),
  ).toISOString();

  let lat = content.readInt32BE(o + 7) / 300000;
  let lng = content.readInt32BE(o + 11) / 300000;

  const speed = (content[o + 15] ?? 0) * 1.852;

  const courseStatus = content.readUInt16BE(o + 16);
  const gpsFixed = (courseStatus & 0x8000) !== 0;
  const latSouth = (courseStatus & 0x4000) !== 0;
  const lngWest = (courseStatus & 0x2000) !== 0;
  const course = courseStatus & 0x03ff;

  if (latSouth) lat = -lat;
  if (lngWest) lng = -lng;

  if (requireGpsFix && !gpsFixed) return null;

  return {
    latitude: lat,
    longitude: lng,
    speed,
    heading: course,
    recordedAt,
  };
}

/**
 * Parse GT06 Location Advanced (0x94). Same 18-byte block layout as 0x22, but latitude/longitude
 * are in NMEA DDMM.MMMMM (DDDMM.MMMMM for longitude), not divisor-300000. Firmware sends float
 * or fixed-point; we convert to decimal degrees via nmeaDdmmToDecimal.
 */
export function getPositionFromGT06LocationAdvanced(
  content: Buffer,
  startOffset: number = 0,
): NormalizedPosition | null {
  if (content.length < startOffset + 18) return null;

  const o = startOffset;
  const year = 2000 + ((content[o + 0] >> 4) * 10 + (content[o + 0] & 0x0f));
  const month = (content[o + 1] >> 4) * 10 + (content[o + 1] & 0x0f);
  const day = (content[o + 2] >> 4) * 10 + (content[o + 2] & 0x0f);
  const hour = (content[o + 3] >> 4) * 10 + (content[o + 3] & 0x0f);
  const min = (content[o + 4] >> 4) * 10 + (content[o + 4] & 0x0f);
  const sec = (content[o + 5] >> 4) * 10 + (content[o + 5] & 0x0f);

  const recordedAt = new Date(
    Date.UTC(year, month - 1, day, hour, min, sec),
  ).toISOString();

  // 0x94: lat/lng as NMEA DDMM.MMMMM (often 4-byte float from device)
  const latRaw =
    content.length >= o + 11
      ? content.readFloatBE(o + 7)
      : content.readInt32BE(o + 7) / 100000;
  const lngRaw =
    content.length >= o + 15
      ? content.readFloatBE(o + 11)
      : content.readInt32BE(o + 11) / 100000;

  const speed = (content[o + 15] ?? 0) * 1.852;
  const courseStatus = content.readUInt16BE(o + 16);
  const gpsFixed = (courseStatus & 0x8000) !== 0;
  const latSouth = (courseStatus & 0x4000) !== 0;
  const lngWest = (courseStatus & 0x2000) !== 0;
  const course = courseStatus & 0x03ff;

  const lat = nmeaDdmmToDecimal(latRaw, latSouth);
  const lng = nmeaDdmmToDecimal(lngRaw, lngWest);

  if (!gpsFixed) return null;

  return {
    latitude: lat,
    longitude: lng,
    speed,
    heading: course,
    recordedAt,
  };
}

/**
 * Extract phone (or extra ASCII) from 0x1A content. After the 18-byte GPS block, byte at (gpsOffset+18) is length, then ASCII.
 * gpsOffset: start of the GPS block (from findGpsOffset when layout is variable).
 */
export function getPhoneFromGT06LocationOnDemand(
  content: Buffer,
  gpsOffset: number = 0,
): string | null {
  const base = gpsOffset + 18;
  if (content.length < base + 1) return null;
  const phoneLen = content[base];
  if (phoneLen <= 0 || phoneLen > 200) return null;
  const phoneStart = base + 1;
  const phoneEnd = phoneStart + phoneLen;
  if (content.length < phoneEnd) return null;
  return content
    .subarray(phoneStart, phoneEnd)
    .toString("ascii")
    .replace(/\0/g, "")
    .trim() || null;
}

/**
 * Parse GT06 location on-demand content (0x1A, trigger via SMS). Layout is variable (ASCII/phone/padding before or after);
 * we locate the 18-byte GPS block dynamically via findGpsOffset.
 * Uses same divisor 300000 as 0x22; some firmwares do not set the GPS fix bit (we accept anyway).
 * Some 0x1A firmwares send latitude as (90 + |lat|) for South and longitude as (360 - |lng|) for West,
 * so we normalize: if lat > 90 then lat = 90 - lat; if lng > 180 then lng = lng - 360.
 */
export function getPositionFromGT06LocationOnDemand(
  content: Buffer,
): NormalizedPosition | null {
  if (content.length < 18) return null;
  const o = findGpsOffset(content) ?? 0;
  if (content.length < o + 18) return null;

  const year = 2000 + ((content[o + 0] >> 4) * 10 + (content[o + 0] & 0x0f));
  const month = (content[o + 1] >> 4) * 10 + (content[o + 1] & 0x0f);
  const day = (content[o + 2] >> 4) * 10 + (content[o + 2] & 0x0f);
  const hour = (content[o + 3] >> 4) * 10 + (content[o + 3] & 0x0f);
  const min = (content[o + 4] >> 4) * 10 + (content[o + 4] & 0x0f);
  const sec = (content[o + 5] >> 4) * 10 + (content[o + 5] & 0x0f);
  const recordedAt = new Date(
    Date.UTC(year, month - 1, day, hour, min, sec),
  ).toISOString();

  let lat = content.readInt32BE(o + 7) / 300000;
  let lng = content.readInt32BE(o + 11) / 300000;
  const speed = (content[o + 15] ?? 0) * 1.852;
  const courseStatus = content.readUInt16BE(o + 16);
  const latSouth = (courseStatus & 0x4000) !== 0;
  const lngWest = (courseStatus & 0x2000) !== 0;
  const course = courseStatus & 0x03ff;

  // Some 0x1A firmwares send South as lat>90 (then 90-lat) and West as lng>180 (then lng-360)
  if (lat > 90) lat = 90 - lat;
  else if (latSouth) lat = -Math.abs(lat);
  if (lng > 180) lng = lng - 360;
  else if (lngWest) lng = -Math.abs(lng);
  if (lng < -180) lng += 360;
  if (lat < -90) lat = -90;
  if (lat > 90) lat = 90;

  return {
    latitude: lat,
    longitude: lng,
    speed,
    heading: course,
    recordedAt,
  };
}

/**
 * Single entry point: parse any GT06 location packet (0x22, 0xA0, 0x94, 0x1A) to a normalized position.
 * Uses the appropriate parser per protocol number; returns null if parsing fails.
 */
export function parseGT06LocationToPosition(
  protocolNumber: number,
  content: Buffer,
): NormalizedPosition | null {
  if (protocolNumber === PROTOCOL_LOCATION_STD) {
    return getPositionFromGT06LocationStd(content);
  }
  if (protocolNumber === PROTOCOL_LOCATION_ON_DEMAND) {
    return getPositionFromGT06LocationOnDemand(content);
  }
  if (protocolNumber === PROTOCOL_LOCATION_ADVANCED) {
    return getPositionFromGT06LocationAdvanced(content);
  }
  if (
    protocolNumber === PROTOCOL_LOCATION_2G ||
    protocolNumber === PROTOCOL_LOCATION_4G
  ) {
    const isLong0x22 = protocolNumber === PROTOCOL_LOCATION_2G && content.length > 40;
    const startOffset = isLong0x22 ? (findGpsOffset(content) ?? 0) : 0;
    return getPositionFromGT06Location(content, startOffset, true);
  }
  return null;
}

/** Build login ACK packet (same serial, protocol 0x01 response). */
export function buildGT06LoginAck(serialNumber: number): Buffer {
  const content = Buffer.alloc(4);
  content.writeUInt16BE(serialNumber, 0);
  content.writeUInt16BE(0x0000, 2);
  return buildGT06Response(PROTOCOL_LOGIN, content, serialNumber);
}

/** Build heartbeat ACK (use same protocol as request: 0x36 or 0x13). */
export function buildGT06HeartbeatAck(
  serialNumber: number,
  protocol: number = PROTOCOL_HEARTBEAT,
): Buffer {
  const content = Buffer.alloc(4);
  content.writeUInt16BE(serialNumber, 0);
  content.writeUInt16BE(0x0000, 2);
  return buildGT06Response(protocol, content, serialNumber);
}

/** Build alarm ACK (0x16 or other alarm protocol). */
export function buildGT06AlarmAck(
  serialNumber: number,
  proto: number = PROTOCOL_ALARM,
): Buffer {
  const content = Buffer.alloc(4);
  content.writeUInt16BE(serialNumber, 0);
  content.writeUInt16BE(0x0000, 2);
  return buildGT06Response(proto, content, serialNumber);
}

/** Build location ACK (same protocol + serial as request: 0x22, 0xa0, 0x94, or 0x1A). */
export function buildGT06LocationAck(
  serialNumber: number,
  protocolNumber: number = PROTOCOL_LOCATION_2G,
): Buffer {
  const content = Buffer.alloc(4);
  content.writeUInt16BE(serialNumber, 0);
  content.writeUInt16BE(0x0000, 2);
  return buildGT06Response(protocolNumber, content, serialNumber);
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
  const crc = crc16Itu(buf.subarray(2, off));
  buf.writeUInt16BE(crc, off);
  off += 2;
  buf[off++] = STOP[0];
  buf[off++] = STOP[1];
  return buf;
}

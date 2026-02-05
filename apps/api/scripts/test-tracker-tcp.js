#!/usr/bin/env node
/**
 * Simple script to test the tracker TCP server (GT06 protocol).
 * Usage: node scripts/test-tracker-tcp.js [host] [port] [imei]
 * Default: localhost 5023 123456789012345
 *
 * Prerequisites: Start the TCP process first: pnpm run start:tracker
 */

const net = require("net");

const START = 0x78;
const STOP = [0x0d, 0x0a];
const PROTOCOL_LOGIN = 0x01;
const PROTOCOL_HEARTBEAT = 0x36;
const PROTOCOL_LOCATION = 0x22;

function crc16(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc & 0xffff;
}

/** IMEI string (15 digits) to 8-byte BCD for GT06 login */
function imeiToBcd(imei) {
  const digits = imei.replace(/\D/g, "").slice(0, 15).padStart(16, "0");
  const buf = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    const high = parseInt(digits[i * 2], 10);
    const low = parseInt(digits[i * 2 + 1], 10);
    buf[i] = (high << 4) | low;
  }
  return buf;
}

/** Build GT06 login packet */
function buildLoginPacket(imei, serial = 1) {
  const content = imeiToBcd(imei);
  const len = 1 + content.length + 2 + 2; // protocol + content + serial + crc
  const buf = Buffer.alloc(2 + 1 + 1 + content.length + 2 + 2 + 2);
  let off = 0;
  buf[off++] = START;
  buf[off++] = START;
  buf[off++] = len;
  buf[off++] = PROTOCOL_LOGIN;
  content.copy(buf, off);
  off += content.length;
  buf.writeUInt16BE(serial, off);
  off += 2;
  const crc = crc16(buf.subarray(2, off));
  buf.writeUInt16BE(crc, off);
  off += 2;
  buf[off++] = STOP[0];
  buf[off++] = STOP[1];
  return buf;
}

/** Build GT06 heartbeat packet */
function buildHeartbeatPacket(serial = 2) {
  const content = Buffer.alloc(4); // empty for heartbeat
  const len = 1 + content.length + 2 + 2;
  const buf = Buffer.alloc(2 + 1 + 1 + content.length + 2 + 2 + 2);
  let off = 0;
  buf[off++] = START;
  buf[off++] = START;
  buf[off++] = len;
  buf[off++] = PROTOCOL_HEARTBEAT;
  content.copy(buf, off);
  off += content.length;
  buf.writeUInt16BE(serial, off);
  off += 2;
  const crc = crc16(buf.subarray(2, off));
  buf.writeUInt16BE(crc, off);
  off += 2;
  buf[off++] = STOP[0];
  buf[off++] = STOP[1];
  return buf;
}

/** Build GT06 location packet (0x22). Lat/lng in degrees, * 30000 for protocol. */
function buildLocationPacket(lat, lng, serial = 3) {
  const now = new Date();
  const content = Buffer.alloc(18);
  let off = 0;
  content[off++] = ((now.getUTCFullYear() % 100) / 10) << 4 | (now.getUTCFullYear() % 10);
  content[off++] = ((now.getUTCMonth() + 1) / 10) << 4 | ((now.getUTCMonth() + 1) % 10);
  content[off++] = (now.getUTCDate() / 10) << 4 | (now.getUTCDate() % 10);
  content[off++] = (now.getUTCHours() / 10) << 4 | (now.getUTCHours() % 10);
  content[off++] = (now.getUTCMinutes() / 10) << 4 | (now.getUTCMinutes() % 10);
  content[off++] = (now.getUTCSeconds() / 10) << 4 | (now.getUTCSeconds() % 10);
  content[off++] = 8; // satellites
  content.writeInt32BE(Math.round(lat * 30000), 7);
  content.writeInt32BE(Math.round(lng * 30000), 11);
  content[15] = 0; // speed (knots)
  content.writeUInt16BE(0, 16); // heading

  const len = 1 + content.length + 2 + 2;
  const buf = Buffer.alloc(2 + 1 + 1 + content.length + 2 + 2 + 2);
  off = 0;
  buf[off++] = START;
  buf[off++] = START;
  buf[off++] = len;
  buf[off++] = PROTOCOL_LOCATION;
  content.copy(buf, off);
  off += content.length;
  buf.writeUInt16BE(serial, off);
  off += 2;
  const crc = crc16(buf.subarray(2, off));
  buf.writeUInt16BE(crc, off);
  off += 2;
  buf[off++] = STOP[0];
  buf[off++] = STOP[1];
  return buf;
}

function run(host, port, imei) {
  const client = net.createConnection({ host, port }, () => {
    console.log(`Connected to ${host}:${port}`);
  });

  client.on("data", (data) => {
    console.log("<- Server:", data.toString("hex"), "(", data.length, "bytes )");
  });

  client.on("error", (err) => {
    console.error("Error:", err.message);
    process.exitCode = 1;
  });

  client.on("close", (hadError) => {
    if (!hadError) console.log("Connection closed.");
  });

  // 1) Login (required first so server knows deviceId/imei)
  const login = buildLoginPacket(imei, 1);
  console.log("-> Login (IMEI " + imei + "):", login.toString("hex"));
  client.write(login);

  // 2) After a short delay, send heartbeat and location
  setTimeout(() => {
    const heartbeat = buildHeartbeatPacket(2);
    console.log("-> Heartbeat:", heartbeat.toString("hex"));
    client.write(heartbeat);
  }, 300);

  setTimeout(() => {
    const location = buildLocationPacket(-23.55, -46.63, 3);
    console.log("-> Location (-23.55, -46.63):", location.toString("hex"));
    client.write(location);
  }, 600);

  setTimeout(() => {
    client.end();
  }, 2000);
}

const host = process.argv[2] || "localhost";
const port = parseInt(process.argv[3] || process.env.TRACKER_TCP_PORT || "5023", 10);
const imei = process.argv[4] || "123456789012345";

console.log("Tracker TCP test — host=%s port=%s imei=%s\n", host, port, imei);
run(host, port, imei);

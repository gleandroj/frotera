#!/usr/bin/env node
/**
 * Tracker TCP test: stream positions along a real route (point A → B) to simulate
 * a device moving at a given speed. Uses Google Directions API to get the path.
 *
 * Usage:
 *   node scripts/test-tracker-tcp.js <origin> <destination> [options]
 *
 * Arguments:
 *   origin        Point A: "lat,lng" or address (e.g. "São Paulo, BR")
 *   destination   Point B: "lat,lng" or address (e.g. "Campinas, BR")
 *
 * Options (env or defaults):
 *   --host=localhost
 *   --port=5023
 *   --imei=123456789012345
 *   --speed=50          Speed in km/h (default 50)
 *   --interval=10       Send position every N seconds (default 10)
 *   --api-key=KEY      Or set GOOGLE_MAPS_API_KEY
 *
 * Example:
 *   GOOGLE_MAPS_API_KEY=your_key node scripts/test-tracker-tcp.js "-23.55,-46.63" "-22.9,-47.06" --speed=60 --interval=15
 *   node scripts/test-tracker-tcp.js "Av Paulista, São Paulo" "Campinas" --speed=80
 *
 * Prerequisites: Start TCP process first: pnpm run start:tracker
 */

const net = require("net");
const https = require("https");

const START = 0x78;
const STOP = [0x0d, 0x0a];
const PROTOCOL_LOGIN = 0x01;
const PROTOCOL_HEARTBEAT = 0x36;
const PROTOCOL_LOCATION = 0x22;

// ---------- GT06 packet helpers (unchanged) ----------
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

function buildLoginPacket(imei, serial = 1) {
  const content = imeiToBcd(imei);
  const len = 1 + content.length + 2 + 2;
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
  buf.writeUInt16BE(crc16(buf.subarray(2, off)), off);
  off += 2;
  buf[off++] = STOP[0];
  buf[off++] = STOP[1];
  return buf;
}

function buildHeartbeatPacket(serial) {
  const content = Buffer.alloc(4);
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
  buf.writeUInt16BE(crc16(buf.subarray(2, off)), off);
  off += 2;
  buf[off++] = STOP[0];
  buf[off++] = STOP[1];
  return buf;
}

/** Build GT06 location packet. date = Date, speedKmh optional, headingDeg 0-359 optional. */
function buildLocationPacket(lat, lng, date, serial, speedKmh = 0, headingDeg = 0) {
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
  buf.writeUInt16BE(crc16(buf.subarray(2, off)), off);
  off += 2;
  buf[off++] = STOP[0];
  buf[off++] = STOP[1];
  return buf;
}

// ---------- Google encoded polyline decode ----------
function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function bearingDeg(lat1, lng1, lat2, lng2) {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  let b = (Math.atan2(y, x) * 180) / Math.PI;
  return (b + 360) % 360;
}

/** Interpolate point between p1 and p2 by fraction t in [0,1]. */
function interpolate(p1, p2, t) {
  return {
    lat: p1.lat + t * (p2.lat - p1.lat),
    lng: p1.lng + t * (p2.lng - p1.lng),
  };
}

/** Fetch route from Google Directions API; return { points, totalDistanceM, totalDurationSec }. */
function fetchRoute(origin, destination, apiKey) {
  return new Promise((resolve, reject) => {
    const originEnc = encodeURIComponent(origin);
    const destEnc = encodeURIComponent(destination);
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originEnc}&destination=${destEnc}&key=${apiKey}`;
    https
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (data.status !== "OK") {
              reject(new Error(`Directions API: ${data.status} - ${data.error_message || ""}`));
              return;
            }
            const route = data.routes[0];
            const leg = route.legs[0];
            const polyline = route.overview_polyline?.points || leg.steps?.map((s) => s.polyline?.points).filter(Boolean).join("");
            if (!polyline) {
              reject(new Error("No polyline in route"));
              return;
            }
            const points = decodePolyline(polyline);
            let totalDistanceM = 0;
            for (let i = 1; i < points.length; i++) {
              totalDistanceM += haversineMeters(
                points[i - 1].lat,
                points[i - 1].lng,
                points[i].lat,
                points[i].lng
              );
            }
            const totalDurationSec = leg.duration?.value ?? Math.round((totalDistanceM / 1000) * (3600 / 50)); // fallback ~50 km/h
            resolve({ points, totalDistanceM, totalDurationSec });
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

/** Build list of { lat, lng, date, speedKmh, heading } at given interval along the path. */
function buildPositionSchedule(points, totalDistanceM, speedKmh, intervalSec) {
  if (points.length < 2) return [];
  const speedMps = (speedKmh * 1000) / 3600;
  const distancePerReport = speedMps * intervalSec;
  const schedule = [];
  let cumulativeM = 0;
  let nextReportM = 0;
  const startDate = new Date();

  for (let i = 1; i < points.length; i++) {
    const segM = haversineMeters(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
    const segHeading = bearingDeg(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);

    while (nextReportM < cumulativeM + segM) {
      const t = (nextReportM - cumulativeM) / segM;
      const pos = interpolate(points[i - 1], points[i], t);
      const reportTimeSec = nextReportM / speedMps;
      const date = new Date(startDate.getTime() + reportTimeSec * 1000);
      schedule.push({
        lat: pos.lat,
        lng: pos.lng,
        date,
        speedKmh,
        heading: segHeading,
      });
      nextReportM += distancePerReport;
    }
    cumulativeM += segM;
  }
  const lastHeading = points.length >= 2
    ? bearingDeg(points[points.length - 2].lat, points[points.length - 2].lng, points[points.length - 1].lat, points[points.length - 1].lng)
    : 0;
  schedule.push({
    lat: points[points.length - 1].lat,
    lng: points[points.length - 1].lng,
    date: new Date(startDate.getTime() + (cumulativeM / speedMps) * 1000),
    speedKmh,
    heading: lastHeading,
  });
  return schedule;
}

// ---------- CLI parsing ----------
function parseArgs() {
  const args = process.argv.slice(2);
  const positional = [];
  const opts = {
    host: process.env.TRACKER_TCP_HOST || "localhost",
    port: parseInt(process.env.TRACKER_TCP_PORT || "5023", 10),
    imei: process.env.TRACKER_TEST_IMEI || "123456789012345",
    speed: 50,
    interval: 10,
    apiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  };
  for (const a of args) {
    if (a.startsWith("--host=")) opts.host = a.slice(7);
    else if (a.startsWith("--port=")) opts.port = parseInt(a.slice(7), 10);
    else if (a.startsWith("--imei=")) opts.imei = a.slice(7);
    else if (a.startsWith("--speed=")) opts.speed = parseFloat(a.slice(8));
    else if (a.startsWith("--interval=")) opts.interval = parseInt(a.slice(11), 10);
    else if (a.startsWith("--api-key=")) opts.apiKey = a.slice(10);
    else positional.push(a);
  }
  return { positional, opts };
}

// ---------- Main: route mode (origin + destination) ----------
async function runRouteMode(origin, destination, opts, client) {
  if (!opts.apiKey) {
    console.error("Missing Google Maps API key. Set GOOGLE_MAPS_API_KEY or use --api-key=KEY");
    process.exitCode = 1;
    return;
  }
  console.log("Fetching route: %s → %s", origin, destination);
  const { points, totalDistanceM, totalDurationSec } = await fetchRoute(origin, destination, opts.apiKey);
  const totalKm = (totalDistanceM / 1000).toFixed(2);
  console.log("Route: %s points, %s km, API duration ~%s min\n", points.length, totalKm, Math.round(totalDurationSec / 60));

  const schedule = buildPositionSchedule(points, totalDistanceM, opts.speed, opts.interval);
  console.log("Sending %s positions every %s s at %s km/h (IMEI %s)\n", schedule.length, opts.interval, opts.speed, opts.imei);

  let serial = 3;
  schedule.forEach((p, i) => {
    setTimeout(
      () => {
        const packet = buildLocationPacket(p.lat, p.lng, p.date, serial++, p.speedKmh, p.heading);
        client.write(packet);
        console.log("[%s] %.6f, %.6f @ %s km/h heading %s°", i + 1, p.lat, p.lng, p.speedKmh, Math.round(p.heading));
      },
      i * opts.interval * 1000
    );
  });

  const totalTimeSec = (schedule.length - 1) * opts.interval;
  setTimeout(() => {
    console.log("\nRoute simulation finished.");
    client.end();
  }, totalTimeSec * 1000 + 2000);
}

// ---------- Main: simple mode (no route, single position) ----------
function runSimpleMode(host, port, imei, client) {
  console.log("Simple test — host=%s port=%s imei=%s\n", host, port, imei);
  const login = buildLoginPacket(imei, 1);
  console.log("-> Login (IMEI %s)", imei);
  client.write(login);
  setTimeout(() => {
    client.write(buildHeartbeatPacket(2));
    console.log("-> Heartbeat");
  }, 300);
  setTimeout(() => {
    const location = buildLocationPacket(-23.55, -46.63, new Date(), 3, 0, 0);
    console.log("-> Location (-23.55, -46.63)");
    client.write(location);
  }, 600);
  setTimeout(() => client.end(), 2000);
}

async function main() {
  const { positional, opts } = parseArgs();
  const [origin, destination] = positional;

  const client = net.createConnection({ host: opts.host, port: opts.port }, () => {
    console.log("Connected to %s:%s\n", opts.host, opts.port);
  });

  client.on("data", (data) => {
    console.log("<- Server: %s (%s bytes)", data.toString("hex"), data.length);
  });
  client.on("error", (err) => {
    console.error("Error:", err.message);
    process.exitCode = 1;
  });
  client.on("close", (hadError) => {
    if (!hadError) console.log("Connection closed.");
  });

  const login = buildLoginPacket(opts.imei, 1);
  client.write(login);
  console.log("-> Login (IMEI %s)", opts.imei);

  if (origin && destination) {
    await new Promise((r) => setTimeout(r, 500));
    await runRouteMode(origin, destination, opts, client);
  } else {
    runSimpleMode(opts.host, opts.port, opts.imei, client);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

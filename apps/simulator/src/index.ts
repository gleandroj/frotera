#!/usr/bin/env node
/**
 * Tracker TCP simulator — stream GT06 positions along real routes (A → B).
 * Uses Google Routes API; routes are cached in tmp/route-cache.
 *
 * Usage:
 *   pnpm run dev [origin] [destination] [options]
 *   pnpm start [origin] [destination] [options]
 *
 * Options: --host=localhost --port=5023 --imei=... --speed=50 --interval=10 --api-key=KEY --no-cache
 * Env: TRACKER_TCP_HOST, TRACKER_TCP_PORT, TRACKER_TEST_IMEI, GOOGLE_MAPS_API_KEY
 *
 * Without origin/destination: simple test (login + heartbeat + one position).
 * Prerequisites: run the tracker TCP server (e.g. from api: pnpm run dev:tcp).
 */

import "dotenv/config";
import * as net from "net";
import type { Socket } from "net";
import type { TrackerTcpOptions } from "./types";
import { buildLoginPacket, buildHeartbeatPacket, buildLocationPacket } from "./gt06";
import { getRoute } from "./routes";
import { buildPositionSchedule } from "./schedule";
import { parseArgs } from "./cli";

async function runRouteMode(
  origin: string,
  destination: string,
  opts: TrackerTcpOptions,
  client: Socket,
): Promise<void> {
  if (!opts.apiKey) {
    console.error("Missing Google Maps API key. Set GOOGLE_MAPS_API_KEY or use --api-key=KEY");
    process.exitCode = 1;
    return;
  }

  console.log("Route: %s → %s", origin, destination);
  const { result, fromCache } = await getRoute(origin, destination, opts.apiKey, {
    noCache: opts.noCache,
  });
  if (fromCache) console.log("(from cache)");
  const { points, totalDistanceM, totalDurationSec } = result;
  const totalKm = (totalDistanceM / 1000).toFixed(2);
  console.log(
    "Route: %s points, %s km, API duration ~%s min\n",
    points.length,
    totalKm,
    Math.round(totalDurationSec / 60),
  );

  const schedule = buildPositionSchedule(
    points,
    totalDistanceM,
    opts.speed,
    opts.interval,
  );
  console.log(
    "Sending %s positions every %s s at %s km/h (IMEI %s)\n",
    schedule.length,
    opts.interval,
    opts.speed,
    opts.imei,
  );

  let serial = 3;
  schedule.forEach((p, i) => {
    setTimeout(() => {
      const packet = buildLocationPacket(
        p.lat,
        p.lng,
        p.date,
        serial++,
        p.speedKmh,
        p.heading,
      );
      client.write(packet);
      console.log(
        "[%s] %.6f, %.6f @ %s km/h heading %s°",
        i + 1,
        p.lat,
        p.lng,
        p.speedKmh,
        Math.round(p.heading),
      );
    }, i * opts.interval * 1000);
  });

  const totalTimeSec = (schedule.length - 1) * opts.interval;
  setTimeout(() => {
    console.log("\nRoute simulation finished.");
    client.end();
  }, totalTimeSec * 1000 + 2000);
}

function runSimpleMode(
  host: string,
  port: number,
  imei: string,
  client: Socket,
): void {
  console.log("Simple test — host=%s port=%s imei=%s\n", host, port, imei);
  setTimeout(() => {
    client.write(buildHeartbeatPacket(2));
    console.log("-> Heartbeat");
  }, 300);
  setTimeout(() => {
    client.write(buildLocationPacket(-23.55, -46.63, new Date(), 3, 0, 0));
    console.log("-> Location (-23.55, -46.63)");
  }, 600);
  setTimeout(() => client.end(), 2000);
}

async function main(): Promise<void> {
  const { positional, opts } = parseArgs();
  const [origin, destination] = positional;

  const client = net.createConnection(
    { host: opts.host, port: opts.port },
    () => {
      console.log("Connected to %s:%s\n", opts.host, opts.port);
    },
  );

  client.on("data", (data: Buffer) => {
    console.log("<- Server: %s (%s bytes)", data.toString("hex"), data.length);
  });
  client.on("error", (err: Error) => {
    console.error("Error:", err.message);
    process.exitCode = 1;
  });
  client.on("close", (hadError: boolean) => {
    if (!hadError) console.log("Connection closed.");
  });

  client.write(buildLoginPacket(opts.imei, 1));
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

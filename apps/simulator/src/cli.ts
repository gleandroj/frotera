import type { TrackerTcpOptions } from "./types";

const DEFAULTS: TrackerTcpOptions = {
  host: "localhost",
  port: 5023,
  imei: "123456789012345",
  speed: 50,
  interval: 10,
  apiKey: "",
};

export function parseArgs(): {
  positional: string[];
  opts: TrackerTcpOptions;
} {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  const opts: TrackerTcpOptions = {
    ...DEFAULTS,
    host: process.env.TRACKER_TCP_HOST ?? DEFAULTS.host,
    port: parseInt(process.env.TRACKER_TCP_PORT ?? String(DEFAULTS.port), 10),
    imei: process.env.TRACKER_TEST_IMEI ?? DEFAULTS.imei,
    speed: DEFAULTS.speed,
    interval: DEFAULTS.interval,
    apiKey: process.env.GOOGLE_MAPS_API_KEY ?? DEFAULTS.apiKey,
  };

  for (const a of args) {
    if (a.startsWith("--host=")) opts.host = a.slice(7);
    else if (a.startsWith("--port=")) opts.port = parseInt(a.slice(7), 10);
    else if (a.startsWith("--imei=")) opts.imei = a.slice(7);
    else if (a.startsWith("--speed=")) opts.speed = parseFloat(a.slice(8));
    else if (a.startsWith("--interval=")) opts.interval = parseInt(a.slice(11), 10);
    else if (a.startsWith("--api-key=")) opts.apiKey = a.slice(10);
    else if (a === "--no-cache") opts.noCache = true;
    else positional.push(a);
  }
  return { positional, opts };
}

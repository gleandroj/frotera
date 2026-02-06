import * as fs from "fs";
import * as path from "path";
import type { RouteResult, CachedRoute } from "./types";

const CACHE_DIR_NAME = "route-cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getCacheDir(): string {
  return path.join(process.cwd(), "tmp", CACHE_DIR_NAME);
}

export function getCacheKey(origin: string, destination: string): string {
  const a = String(origin).trim().toLowerCase();
  const b = String(destination).trim().toLowerCase();
  const combined = a < b ? `${a}\0${b}` : `${b}\0${a}`;
  let h = 0;
  for (let i = 0; i < combined.length; i++) {
    h = (h << 5) - h + combined.charCodeAt(i);
    h |= 0;
  }
  return "route-" + Math.abs(h).toString(36) + ".json";
}

function ensureCacheDir(): void {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readCache(origin: string, destination: string): RouteResult | null {
  const file = path.join(getCacheDir(), getCacheKey(origin, destination));
  if (!fs.existsSync(file)) return null;
  try {
    const data: CachedRoute = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Date.now() - new Date(data.cachedAt).getTime() > CACHE_TTL_MS) return null;
    return {
      points: data.points,
      totalDistanceM: data.totalDistanceM,
      totalDurationSec: data.totalDurationSec,
    };
  } catch {
    return null;
  }
}

export function writeCache(
  origin: string,
  destination: string,
  result: RouteResult,
): void {
  ensureCacheDir();
  const file = path.join(getCacheDir(), getCacheKey(origin, destination));
  const data: CachedRoute = {
    origin,
    destination,
    points: result.points,
    totalDistanceM: result.totalDistanceM,
    totalDurationSec: result.totalDurationSec,
    cachedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 0), "utf8");
}

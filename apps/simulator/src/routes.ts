import * as https from "https";
import type { RouteResult, RoutesWaypoint } from "./types";
import { decodePolyline } from "./geo";
import { readCache, writeCache } from "./route-cache";

export function toWaypoint(input: string): RoutesWaypoint {
  const trimmed = String(input).trim();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (match) {
    return {
      location: {
        latLng: {
          latitude: parseFloat(match[1]),
          longitude: parseFloat(match[2]),
        },
      },
    };
  }
  return { address: trimmed };
}

function parseDurationSec(str: string | undefined): number {
  if (!str || typeof str !== "string") return 0;
  const m = str.match(/^(\d+(?:\.\d+)?)s$/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

function fetchRouteFromApi(
  origin: string,
  destination: string,
  apiKey: string,
): Promise<RouteResult> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      origin: toWaypoint(origin),
      destination: toWaypoint(destination),
      travelMode: "DRIVE",
      polylineEncoding: "ENCODED_POLYLINE",
    });
    const opts: https.RequestOptions = {
      hostname: "routes.googleapis.com",
      path: "/directions/v2:computeRoutes",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body, "utf8"),
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data) as {
            error?: { message?: string };
            message?: string;
            routes?: Array<{
              polyline?: { encodedPolyline?: string };
              distanceMeters?: number;
              duration?: string;
            }>;
          };
          if (res.statusCode !== 200) {
            reject(new Error(`Routes API: ${res.statusCode} - ${json.error?.message ?? json.message ?? data}`));
            return;
          }
          const routes = json.routes;
          if (!routes?.length) {
            reject(new Error("Routes API: no route found"));
            return;
          }
          const polyline = routes[0].polyline?.encodedPolyline;
          if (!polyline) {
            reject(new Error("Routes API: no polyline in route"));
            return;
          }
          const totalDistanceM = routes[0].distanceMeters ?? 0;
          const totalDurationSec =
            parseDurationSec(routes[0].duration) ||
            Math.round((totalDistanceM / 1000) * (3600 / 50));
          resolve({
            points: decodePolyline(polyline),
            totalDistanceM,
            totalDurationSec,
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function getRoute(
  origin: string,
  destination: string,
  apiKey: string,
  options: { noCache?: boolean } = {},
): Promise<{ result: RouteResult; fromCache: boolean }> {
  if (!options.noCache) {
    const cached = readCache(origin, destination);
    if (cached) return { result: cached, fromCache: true };
  }
  const result = await fetchRouteFromApi(origin, destination, apiKey);
  writeCache(origin, destination, result);
  return { result, fromCache: false };
}

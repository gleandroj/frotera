import { GeofenceType } from "@prisma/client";

const EARTH_RADIUS_M = 6_371_000;

/**
 * Haversine distance in meters between two WGS84 points [lat, lng].
 */
export function haversineDistance(
  a: [number, number],
  b: [number, number],
): number {
  const [lat1, lon1] = a.map((d) => (d * Math.PI) / 180);
  const [lat2, lon2] = b.map((d) => (d * Math.PI) / 180);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Ray casting — point [lat, lng] inside polygon (same format), min 3 vertices.
 */
export function pointInPolygon(
  point: [number, number],
  polygon: [number, number][],
): boolean {
  if (polygon.length < 3) return false;
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInCircle(
  point: [number, number],
  center: [number, number],
  radiusM: number,
): boolean {
  return haversineDistance(point, center) <= radiusM;
}

export function isPointInZone(
  point: [number, number],
  zone: { type: GeofenceType; coordinates: unknown },
): boolean {
  const c = zone.coordinates as Record<string, unknown>;
  if (zone.type === GeofenceType.CIRCLE) {
    const center = c.center as [number, number] | undefined;
    const radius = c.radius as number | undefined;
    if (
      !center ||
      center.length !== 2 ||
      typeof radius !== "number" ||
      radius <= 0
    ) {
      return false;
    }
    return pointInCircle(point, center, radius);
  }
  const raw = c.points as unknown;
  if (!Array.isArray(raw) || raw.length < 3) return false;
  const poly: [number, number][] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) return false;
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    poly.push([lat, lng]);
  }
  return pointInPolygon(point, poly);
}

import { GeofenceType } from "@prisma/client";
import {
  haversineDistance,
  isPointInZone,
  pointInCircle,
  pointInPolygon,
} from "./geofence.utils";

describe("geofence.utils", () => {
  it("pointInPolygon: inside square", () => {
    const square: [number, number][] = [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
    ];
    expect(pointInPolygon([1, 1], square)).toBe(true);
  });

  it("pointInPolygon: outside square", () => {
    const square: [number, number][] = [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
    ];
    expect(pointInPolygon([3, 3], square)).toBe(false);
  });

  it("pointInCircle: inside radius", () => {
    const center: [number, number] = [-23.55, -46.63];
    const near: [number, number] = [-23.5501, -46.63];
    expect(pointInCircle(near, center, 500)).toBe(true);
  });

  it("pointInCircle: outside radius", () => {
    const center: [number, number] = [-23.55, -46.63];
    const far: [number, number] = [-24.0, -47.0];
    expect(pointInCircle(far, center, 100)).toBe(false);
  });

  it("haversineDistance: SP–RJ order of magnitude", () => {
    const sp: [number, number] = [-23.5505, -46.6333];
    const rj: [number, number] = [-22.9068, -43.1729];
    const d = haversineDistance(sp, rj);
    expect(d).toBeGreaterThan(300_000);
    expect(d).toBeLessThan(400_000);
  });

  it("isPointInZone CIRCLE", () => {
    expect(
      isPointInZone([-23.55, -46.63], {
        type: GeofenceType.CIRCLE,
        coordinates: { center: [-23.55, -46.63], radius: 5000 },
      }),
    ).toBe(true);
  });

  it("isPointInZone POLYGON", () => {
    expect(
      isPointInZone([1, 1], {
        type: GeofenceType.POLYGON,
        coordinates: {
          points: [
            [0, 0],
            [0, 3],
            [3, 3],
            [3, 0],
          ],
        },
      }),
    ).toBe(true);
  });
});

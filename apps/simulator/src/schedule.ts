import type { LatLng, ScheduledPosition } from "./types";
import { haversineMeters, bearingDeg, interpolate } from "./geo";

export function buildPositionSchedule(
  points: LatLng[],
  _totalDistanceM: number,
  speedKmh: number,
  intervalSec: number,
): ScheduledPosition[] {
  if (points.length < 2) return [];

  const speedMps = (speedKmh * 1000) / 3600;
  const distancePerReport = speedMps * intervalSec;
  const schedule: ScheduledPosition[] = [];
  let cumulativeM = 0;
  let nextReportM = 0;
  const startDate = new Date();

  for (let i = 1; i < points.length; i++) {
    const segM = haversineMeters(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng,
    );
    const segHeading = bearingDeg(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng,
    );

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

  const lastHeading =
    points.length >= 2
      ? bearingDeg(
          points[points.length - 2].lat,
          points[points.length - 2].lng,
          points[points.length - 1].lat,
          points[points.length - 1].lng,
        )
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

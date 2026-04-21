"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { trackerDevicesAPI } from "@/lib/frontend/api-client";
import type { PositionPoint } from "@/components/devices/device-map";
import { useTranslation } from "@/i18n/useTranslation";

// Load map dynamically (SSR: false)
const RouteReplayMapDynamic = dynamic(
  () => import("./route-replay-map").then((m) => ({ default: m.RouteReplayMap })),
  { ssr: false }
);

interface Props {
  vehicleId: string;
  deviceId: string;
  organizationId: string;
}

const SPEED_OPTIONS = [1, 2, 5, 10];

export function VehicleReplayTab({ vehicleId, deviceId, organizationId }: Props) {
  const { t } = useTranslation();
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 16));
  const [positions, setPositions] = useState<PositionPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    setPlaying(false);
    setCurrentIdx(0);
    try {
      const res = await trackerDevicesAPI.getPositionHistory(organizationId, deviceId, {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        limit: 2000,
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setPositions(list.map((p: any) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude ?? null,
        speed: p.speed ?? null,
        heading: p.heading ?? null,
        recordedAt: p.recordedAt,
      })));
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, deviceId, from, to]);

  useEffect(() => {
    if (playing && positions.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIdx((prev) => {
          if (prev >= positions.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 200 / speed); // 200ms base interval, divided by speed
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed, positions.length]);

  const currentPos = positions[currentIdx] ?? null;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t("trackingReports.startDate")}</label>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t("trackingReports.endDate")}</label>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          />
        </div>
        <Button onClick={fetchPositions} disabled={loading} size="sm">
          {loading ? t("trackingReports.searching") : t("trackingReports.search")}
        </Button>
      </div>

      {positions.length === 0 && !loading && (
        <p className="text-muted-foreground text-sm">{t("trackingReports.replay.selectPeriodMessage")}</p>
      )}

      {positions.length > 0 && (
        <>
          {/* Map */}
          <div className="h-[450px] rounded-lg overflow-hidden border">
            <RouteReplayMapDynamic positions={positions} currentIdx={currentIdx} />
          </div>

          {/* Controls */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setCurrentIdx(0); setPlaying(false); }}
              >
                ◀◀
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? "⏸" : "▶"}
              </Button>
              <div className="flex gap-1">
                {SPEED_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    variant={speed === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSpeed(s)}
                    className="min-w-[40px]"
                  >
                    {s}x
                  </Button>
                ))}
              </div>
              <span className="text-sm text-muted-foreground ml-auto">
                {currentIdx + 1}/{positions.length}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={positions.length - 1}
              step={1}
              value={currentIdx}
              onChange={(e) => { setCurrentIdx(parseInt(e.target.value)); setPlaying(false); }}
              className="w-full"
            />

            {currentPos && (
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>{new Date(currentPos.recordedAt).toLocaleString()}</span>
                {currentPos.speed != null && <span>{t("trackingReports.speed")}: {currentPos.speed.toFixed(1)} km/h</span>}
                <span>Lat: {currentPos.latitude.toFixed(6)}, Lng: {currentPos.longitude.toFixed(6)}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

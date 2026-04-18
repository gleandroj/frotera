"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Circle,
  MapContainer,
  Polygon,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GeofenceTypeApi } from "@/lib/frontend/api-client";
import { useTranslation } from "@/i18n/useTranslation";

const DEFAULT_CENTER: [number, number] = [-15.77972, -47.92972];
const MIN_RADIUS_KM = 0.1;
const MAX_RADIUS_KM = 100;
/** Half-kilometer steps: usable slider range (0.5–500 km) without excessive granularity. */
const STEP_KM = 0.1;

function parseCenter(raw: unknown): [number, number] {
  if (!Array.isArray(raw) || raw.length < 2) return DEFAULT_CENTER;
  const la = Number(raw[0]);
  const ln = Number(raw[1]);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return DEFAULT_CENTER;
  return [la, ln];
}

/** `coordinates.radius` is stored in meters (API / DB). */
function parseRadiusMeters(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return MIN_RADIUS_KM * 1000;
  return n;
}

function clampRadiusKm(km: number): number {
  if (!Number.isFinite(km)) return MIN_RADIUS_KM;
  const stepped = Math.round(km / STEP_KM) * STEP_KM;
  return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, stepped));
}

function parsePoints(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return [];
  const out: [number, number][] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const la = Number(p[0]);
    const ln = Number(p[1]);
    if (Number.isFinite(la) && Number.isFinite(ln)) out.push([la, ln]);
  }
  return out;
}

function MapClick({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function GeofenceMapEditor({
  type,
  coordinates,
  onChange,
  syncKey,
}: {
  type: GeofenceTypeApi;
  coordinates: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** When this value changes, internal map state resets from `coordinates`. */
  syncKey: string;
}) {
  const { t } = useTranslation();
  const [center, setCenter] = useState<[number, number]>(() =>
    parseCenter(coordinates.center),
  );
  const [radiusKm, setRadiusKm] = useState(() =>
    clampRadiusKm(parseRadiusMeters(coordinates.radius) / 1000),
  );
  const [points, setPoints] = useState<[number, number][]>(() =>
    parsePoints(coordinates.points),
  );

  useEffect(() => {
    if (type === "CIRCLE") {
      setCenter(parseCenter(coordinates.center));
      setRadiusKm(clampRadiusKm(parseRadiusMeters(coordinates.radius) / 1000));
    } else {
      setPoints(parsePoints(coordinates.points));
    }
  }, [type, coordinates, syncKey]);

  const radiusMeters = radiusKm * 1000;

  const mapCenter = useMemo(() => {
    if (type === "POLYGON" && points.length > 0) return points[0]!;
    return center;
  }, [type, points, center]);

  const setCircleRadiusKm = useCallback(
    (nextKm: number) => {
      const km = clampRadiusKm(nextKm);
      setRadiusKm(km);
      onChange({ center, radius: km * 1000 });
    },
    [center, onChange],
  );

  const onMapClick = useCallback(
    (lat: number, lng: number) => {
      if (type === "CIRCLE") {
        const next: [number, number] = [lat, lng];
        setCenter(next);
        onChange({ center: next, radius: radiusKm * 1000 });
      } else {
        setPoints((prev) => {
          const next = [...prev, [lat, lng] as [number, number]];
          onChange({ points: next });
          return next;
        });
      }
    },
    [type, onChange, radiusKm],
  );

  const closePolygon = useCallback(() => {
    if (points.length < 3) return;
    onChange({ points });
  }, [points, onChange]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {type === "CIRCLE"
          ? t("telemetry.geofences.form.mapInstructions.circle")
          : t("telemetry.geofences.form.mapInstructions.polygon")}
      </p>
      <div className="h-[280px] w-full overflow-hidden rounded-md border">
        <MapContainer
          center={mapCenter}
          zoom={type === "POLYGON" && points.length > 1 ? 14 : 13}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClick onClick={onMapClick} />
          {type === "CIRCLE" && (
            <Circle
              center={center}
              radius={radiusMeters}
              pathOptions={{ color: "#2563eb" }}
            />
          )}
          {type === "POLYGON" && points.length > 0 && (
            <Polygon
              positions={points}
              pathOptions={{ color: "#16a34a", fillOpacity: 0.15 }}
            />
          )}
        </MapContainer>
      </div>
      {type === "CIRCLE" && (
        <div className="space-y-2">
          <Label>{t("telemetry.geofences.form.radiusKm")}</Label>
          <Slider
            value={[radiusKm]}
            min={MIN_RADIUS_KM}
            max={MAX_RADIUS_KM}
            step={STEP_KM}
            onValueChange={(v) => {
              const r = v[0] ?? radiusKm;
              setCircleRadiusKm(r);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={MIN_RADIUS_KM}
              max={MAX_RADIUS_KM}
              step={STEP_KM}
              className="max-w-[140px]"
              value={radiusKm}
              onChange={(e) => {
                const x = parseFloat(e.target.value.replace(",", "."));
                if (!Number.isFinite(x)) return;
                setCircleRadiusKm(x);
              }}
            />
            <span className="text-xs text-muted-foreground">km</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("telemetry.geofences.form.radiusKmHint", {
              meters: Math.round(radiusMeters).toLocaleString(),
            })}
          </p>
        </div>
      )}
      {type === "POLYGON" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
            onClick={closePolygon}
            disabled={points.length < 3}
          >
            {t("telemetry.geofences.form.closePolygon")}
          </button>
          <button
            type="button"
            className="rounded-md border bg-muted px-3 py-1.5 text-sm"
            onClick={() => {
              setPoints([]);
              onChange({ points: [] });
            }}
          >
            {t("telemetry.geofences.form.resetPolygon")}
          </button>
        </div>
      )}
    </div>
  );
}

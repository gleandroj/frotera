"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Polygon,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GeofenceTypeApi } from "@/lib/frontend/api-client";
import { useTranslation } from "@/i18n/useTranslation";

const DEFAULT_CENTER: [number, number] = [-15.77972, -47.92972];
/** `coordinates.radius` is stored in meters (API / DB). */
const MIN_RADIUS_M = 5;
const MAX_RADIUS_M = 10_000;
const STEP_RADIUS_M = 5;

function parseCenter(raw: unknown): [number, number] {
  if (!Array.isArray(raw) || raw.length < 2) return DEFAULT_CENTER;
  const la = Number(raw[0]);
  const ln = Number(raw[1]);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return DEFAULT_CENTER;
  return [la, ln];
}

function parseRadiusMeters(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return 500;
  return n;
}

function clampRadiusMeters(m: number): number {
  if (!Number.isFinite(m)) return MIN_RADIUS_M;
  const stepped = Math.round(m / STEP_RADIUS_M) * STEP_RADIUS_M;
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, stepped));
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

function isDefaultCenter(c: [number, number]): boolean {
  return (
    Math.abs(c[0] - DEFAULT_CENTER[0]) < 1e-4 &&
    Math.abs(c[1] - DEFAULT_CENTER[1]) < 1e-4
  );
}

function MapCenterSync({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
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
  preferBrowserCenter = false,
}: {
  type: GeofenceTypeApi;
  coordinates: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** When this value changes, internal map state resets from `coordinates`. */
  syncKey: string;
  /** When true (e.g. new zone), center the map on `navigator.geolocation` if still at the default. */
  preferBrowserCenter?: boolean;
}) {
  const { t } = useTranslation();
  const [center, setCenter] = useState<[number, number]>(() =>
    parseCenter(coordinates.center),
  );
  const [radiusM, setRadiusM] = useState(() =>
    clampRadiusMeters(parseRadiusMeters(coordinates.radius)),
  );
  const [points, setPoints] = useState<[number, number][]>(() =>
    parsePoints(coordinates.points),
  );
  const radiusMRef = useRef(radiusM);
  radiusMRef.current = radiusM;
  const coordinatesRef = useRef(coordinates);
  coordinatesRef.current = coordinates;

  const browserGeoAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    browserGeoAttemptRef.current = null;
  }, [syncKey]);

  useEffect(() => {
    if (type === "CIRCLE") {
      setCenter(parseCenter(coordinates.center));
      setRadiusM(clampRadiusMeters(parseRadiusMeters(coordinates.radius)));
    } else {
      setPoints(parsePoints(coordinates.points));
    }
  }, [type, coordinates, syncKey]);

  useEffect(() => {
    if (!preferBrowserCenter) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const attemptKey = `${syncKey}:${type}`;
    if (browserGeoAttemptRef.current === attemptKey) return;

    if (type === "CIRCLE") {
      if (!isDefaultCenter(parseCenter(coordinates.center))) return;
    } else {
      if (parsePoints(coordinates.points).length > 0) return;
      if (!isDefaultCenter(parseCenter(coordinates.center))) return;
    }

    browserGeoAttemptRef.current = attemptKey;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const next: [number, number] = [
          pos.coords.latitude,
          pos.coords.longitude,
        ];
        if (type === "CIRCLE") {
          const c = parseCenter(coordinatesRef.current.center);
          if (!isDefaultCenter(c)) return;
          setCenter(next);
          onChange({
            center: next,
            radius: radiusMRef.current,
          });
        } else {
          const pts = parsePoints(coordinatesRef.current.points);
          if (pts.length > 0) return;
          const c = parseCenter(coordinatesRef.current.center);
          if (!isDefaultCenter(c)) return;
          setCenter(next);
        }
      },
      () => {
        /* permission denied or timeout: keep default center */
        browserGeoAttemptRef.current = null;
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 15_000,
      },
    );
    return () => {
      cancelled = true;
    };
  }, [
    type,
    preferBrowserCenter,
    syncKey,
    coordinates.center,
    coordinates.points,
    onChange,
  ]);

  const mapCenter = useMemo(() => {
    if (type === "POLYGON" && points.length > 0) return points[0]!;
    return center;
  }, [type, points, center]);

  const mapZoom = type === "POLYGON" && points.length > 1 ? 14 : 13;

  const setCircleRadiusM = useCallback(
    (nextM: number) => {
      const m = clampRadiusMeters(nextM);
      setRadiusM(m);
      onChange({ center, radius: m });
    },
    [center, onChange],
  );

  const onMapClick = useCallback(
    (lat: number, lng: number) => {
      if (type === "CIRCLE") {
        const next: [number, number] = [lat, lng];
        setCenter(next);
        onChange({ center: next, radius: radiusM });
      } else {
        setPoints((prev) => {
          const next = [...prev, [lat, lng] as [number, number]];
          onChange({ points: next });
          return next;
        });
      }
    },
    [type, onChange, radiusM],
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
          zoom={mapZoom}
          className="h-full w-full"
          scrollWheelZoom
        >
          <MapCenterSync center={mapCenter} zoom={mapZoom} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClick onClick={onMapClick} />
          {type === "CIRCLE" && (
            <Circle
              center={center}
              radius={radiusM}
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
          <Label>{t("telemetry.geofences.form.radiusMeters")}</Label>
          <Slider
            value={[radiusM]}
            min={MIN_RADIUS_M}
            max={MAX_RADIUS_M}
            step={STEP_RADIUS_M}
            onValueChange={(v) => {
              const r = v[0] ?? radiusM;
              setCircleRadiusM(r);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={MIN_RADIUS_M}
              max={MAX_RADIUS_M}
              step={STEP_RADIUS_M}
              className="max-w-[140px]"
              value={radiusM}
              onChange={(e) => {
                const x = parseFloat(e.target.value.replace(",", "."));
                if (!Number.isFinite(x)) return;
                setCircleRadiusM(x);
              }}
            />
            <span className="text-xs text-muted-foreground">m</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("telemetry.geofences.form.radiusMetersHint")}
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

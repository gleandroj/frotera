"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
const MAX_RADIUS_M = 5_000;
const STEP_RADIUS_M = 5;
const MAP_EDIT_ZOOM = 14;

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

function mergeCoordinates(
  prev: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...prev, ...patch };
}

/** Applies `setView` only when `nonce` bumps — not on radius drags or circle geometry updates. */
function MapCameraApply({
  nonce,
  center,
  zoom,
}: {
  nonce: number;
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
    // `center` / `zoom` are intentionally omitted: only explicit `nonce` bumps should move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, nonce]);
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
  syncKey: string;
  preferBrowserCenter?: boolean;
}) {
  const { t } = useTranslation();
  const [circleCenter, setCircleCenter] = useState<[number, number]>(() =>
    parseCenter(coordinates.center),
  );
  const [radiusM, setRadiusM] = useState(() =>
    clampRadiusMeters(parseRadiusMeters(coordinates.radius)),
  );
  const [points, setPoints] = useState<[number, number][]>(() =>
    parsePoints(coordinates.points),
  );

  /** MapContainer initial center (stable props — avoids Leaflet resetting view on parent re-renders). */
  const [mapBootstrapCenter] = useState<[number, number]>(() =>
    parseCenter(coordinates.center),
  );
  /** Bumps only when we intentionally move the camera (open zone, type→circle, geolocation). */
  const [cameraNonce, setCameraNonce] = useState(0);
  const [cameraTarget, setCameraTarget] = useState<[number, number]>(() =>
    parseCenter(coordinates.center),
  );
  const [cameraZoom] = useState(MAP_EDIT_ZOOM);

  const bumpCamera = useCallback((center: [number, number], zoom = MAP_EDIT_ZOOM) => {
    setCameraTarget(center);
    setCameraNonce((n) => n + 1);
  }, []);

  const radiusMRef = useRef(radiusM);
  radiusMRef.current = radiusM;
  const coordinatesRef = useRef(coordinates);
  coordinatesRef.current = coordinates;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const typeRef = useRef(type);
  typeRef.current = type;

  const browserGeoAttemptRef = useRef<string | null>(null);
  const prevTypeRef = useRef<GeofenceTypeApi>(type);

  useEffect(() => {
    browserGeoAttemptRef.current = null;
  }, [syncKey]);

  /** Full hydrate when the dialog / zone instance changes. */
  useEffect(() => {
    if (type === "CIRCLE") {
      const cc = parseCenter(coordinates.center);
      setCircleCenter(cc);
      setRadiusM(clampRadiusMeters(parseRadiusMeters(coordinates.radius)));
      setPoints([]);
      bumpCamera(cc, MAP_EDIT_ZOOM);
    } else {
      const pts = parsePoints(coordinates.points);
      setPoints(pts);
      const hint = parseCenter(coordinates.center);
      if (!isDefaultCenter(hint)) bumpCamera(hint, MAP_EDIT_ZOOM);
      else if (pts.length > 0) bumpCamera(pts[0]!, MAP_EDIT_ZOOM);
      else bumpCamera(DEFAULT_CENTER, MAP_EDIT_ZOOM);
    }
    prevTypeRef.current = type;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when syncKey changes
  }, [syncKey]);

  /** Circle ↔ polygon: sync geometry; move camera only when switching to circle. */
  useEffect(() => {
    const prev = prevTypeRef.current;
    if (prev === type) return;
    prevTypeRef.current = type;

    if (type === "POLYGON") {
      setPoints(parsePoints(coordinates.points));
      return;
    }

    const cc = parseCenter(coordinates.center);
    setCircleCenter(cc);
    setRadiusM(clampRadiusMeters(parseRadiusMeters(coordinates.radius)));
    setPoints([]);
    bumpCamera(cc, MAP_EDIT_ZOOM);
  }, [type, coordinates, bumpCamera]);

  useEffect(() => {
    if (!preferBrowserCenter) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const attemptKey = `${syncKey}:${type}`;
    if (browserGeoAttemptRef.current === attemptKey) return;

    const coords = coordinatesRef.current;
    if (typeRef.current === "CIRCLE") {
      if (!isDefaultCenter(parseCenter(coords.center))) return;
    } else {
      if (parsePoints(coords.points).length > 0) return;
      if (!isDefaultCenter(parseCenter(coords.center))) return;
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
        const c = coordinatesRef.current;
        const tMode = typeRef.current;
        if (tMode === "CIRCLE") {
          if (!isDefaultCenter(parseCenter(c.center))) return;
          setCircleCenter(next);
          bumpCamera(next, MAP_EDIT_ZOOM);
          onChangeRef.current({
            center: next,
            radius: radiusMRef.current,
          });
        } else {
          if (parsePoints(c.points).length > 0) return;
          if (!isDefaultCenter(parseCenter(c.center))) return;
          bumpCamera(next, MAP_EDIT_ZOOM);
        }
      },
      () => {
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
  }, [type, preferBrowserCenter, syncKey, bumpCamera]);

  const setCircleRadiusM = useCallback(
    (nextM: number) => {
      const m = clampRadiusMeters(nextM);
      setRadiusM(m);
      onChange({ center: circleCenter, radius: m });
    },
    [circleCenter, onChange],
  );

  const onMapClick = useCallback(
    (lat: number, lng: number) => {
      if (type === "CIRCLE") {
        const next: [number, number] = [lat, lng];
        setCircleCenter(next);
        onChange({ center: next, radius: radiusM });
      } else {
        const nextPts = [...points, [lat, lng] as [number, number]];
        setPoints(nextPts);
        onChange(
          mergeCoordinates(coordinatesRef.current, { points: nextPts }),
        );
      }
    },
    [type, onChange, radiusM, points],
  );

  const closePolygon = useCallback(() => {
    if (points.length < 3) return;
    onChange(mergeCoordinates(coordinatesRef.current, { points }));
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
          center={mapBootstrapCenter}
          zoom={MAP_EDIT_ZOOM}
          className="h-full w-full"
          scrollWheelZoom
        >
          <MapCameraApply
            nonce={cameraNonce}
            center={cameraTarget}
            zoom={cameraZoom}
          />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClick onClick={onMapClick} />
          {type === "CIRCLE" && (
            <Circle
              center={circleCenter}
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
              onChange(
                mergeCoordinates(coordinatesRef.current, { points: [] }),
              );
            }}
          >
            {t("telemetry.geofences.form.resetPolygon")}
          </button>
        </div>
      )}
    </div>
  );
}

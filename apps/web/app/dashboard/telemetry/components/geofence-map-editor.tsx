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
import { Label } from "@/components/ui/label";
import type { GeofenceTypeApi } from "@/lib/frontend/api-client";
import { useTranslation } from "@/i18n/useTranslation";

const DEFAULT_CENTER: [number, number] = [-15.77972, -47.92972];

function parseCenter(raw: unknown): [number, number] {
  if (!Array.isArray(raw) || raw.length < 2) return DEFAULT_CENTER;
  const la = Number(raw[0]);
  const ln = Number(raw[1]);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return DEFAULT_CENTER;
  return [la, ln];
}

function parseRadius(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n >= 1 ? n : 500;
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
  const [radius, setRadius] = useState(() => parseRadius(coordinates.radius));
  const [points, setPoints] = useState<[number, number][]>(() =>
    parsePoints(coordinates.points),
  );

  useEffect(() => {
    if (type === "CIRCLE") {
      setCenter(parseCenter(coordinates.center));
      setRadius(parseRadius(coordinates.radius));
    } else {
      setPoints(parsePoints(coordinates.points));
    }
  }, [type, coordinates, syncKey]);

  const mapCenter = useMemo(() => {
    if (type === "POLYGON" && points.length > 0) return points[0]!;
    return center;
  }, [type, points, center]);

  const onMapClick = useCallback(
    (lat: number, lng: number) => {
      if (type === "CIRCLE") {
        const next: [number, number] = [lat, lng];
        setCenter(next);
        onChange({ center: next, radius });
      } else {
        setPoints((prev) => {
          const next = [...prev, [lat, lng] as [number, number]];
          onChange({ points: next });
          return next;
        });
      }
    },
    [type, onChange, radius],
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
            <Circle center={center} radius={radius} pathOptions={{ color: "#2563eb" }} />
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
          <Label>{t("telemetry.geofences.form.radius")}</Label>
          <Slider
            value={[radius]}
            min={50}
            max={50_000}
            step={50}
            onValueChange={(v) => {
              const r = v[0] ?? radius;
              setRadius(r);
              onChange({ center, radius: r });
            }}
          />
          <p className="text-xs text-muted-foreground">
            {t("telemetry.geofences.form.radiusHint")} — {radius} m
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

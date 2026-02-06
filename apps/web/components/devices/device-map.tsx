"use client";

import { useEffect, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Truck } from "lucide-react";

import "leaflet/dist/leaflet.css";
import { useTranslation } from "@/i18n/useTranslation";

function MapCenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export interface PositionPoint {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  recordedAt: string;
}

const defaultCenter: [number, number] = [-15.77972, -47.92972];

const MARKER_SIZE = 44;

function LastPositionMarker({ position }: { position: PositionPoint | null }) {
  const { t } = useTranslation();
  if (!position) return null;
  const heading = position.heading ?? 0;
  const icon = L.divIcon({
    className: "device-marker device-marker-vehicle",
    html: renderToStaticMarkup(
      <div
        style={{
          width: MARKER_SIZE,
          height: MARKER_SIZE,
          borderRadius: "50%",
          background: "#2563eb",
          border: "3px solid white",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            transform: `rotate(${heading}deg)`,
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Truck size={24} color="white" strokeWidth={2} />
        </div>
      </div>
    ),
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
  });
  return (
    <Marker
      position={[position.latitude, position.longitude]}
      icon={icon}
      zIndexOffset={1000}
    >
      <Popup>
        <div className="text-sm">
          <div>{t("devices.lastUpdate")}: {new Date(position.recordedAt).toLocaleString()}</div>
          {position.speed != null && (
            <div>{t("devices.speed")}: {Number(position.speed).toFixed(2)} {t("devices.speedUnit")}</div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

interface DeviceMapProps {
  initialPositions: PositionPoint[];
  streamedPositions: PositionPoint[];
  lastPosition: PositionPoint | null;
  className?: string;
}

export function DeviceMap({
  initialPositions,
  streamedPositions,
  lastPosition,
  className = "h-[500px] w-full rounded-md border",
}: DeviceMapProps) {
  const allPositions = useMemo(
    () => [...initialPositions, ...streamedPositions],
    [initialPositions, streamedPositions]
  );
  /** Most recent position by recordedAt (API often returns newest-first, so index 0). */
  const lastPositionByTime = useMemo((): PositionPoint | null => {
    if (allPositions.length === 0) return lastPosition;
    return allPositions.reduce((latest, p) =>
      new Date(p.recordedAt) > new Date(latest.recordedAt) ? p : latest
    );
  }, [allPositions, lastPosition]);
  /** Chronological order (oldest → newest) for drawing the route. */
  const polylinePositions = useMemo(() => {
    const sorted = [...allPositions].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    return sorted.map((p) => [p.latitude, p.longitude] as [number, number]);
  }, [allPositions]);
  const center = useMemo((): [number, number] => {
    if (lastPositionByTime) {
      return [lastPositionByTime.latitude, lastPositionByTime.longitude];
    }
    return defaultCenter;
  }, [lastPositionByTime]);

  const zoom = 14;

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full rounded-md"
      >
        <MapCenter center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polylinePositions.length > 1 && (
          <Polyline positions={polylinePositions} color="#2563eb" weight={4} />
        )}
        <LastPositionMarker position={lastPositionByTime} />
      </MapContainer>
    </div>
  );
}

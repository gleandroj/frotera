"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

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

function LastPositionMarker({ position }: { position: PositionPoint | null }) {
  const { t } = useTranslation();
  if (!position) return null;
  const icon = L.divIcon({
    className: "device-marker",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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
            <div>{t("devices.speed")}: {position.speed} {t("devices.speedUnit")}</div>
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

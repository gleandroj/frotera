"use client";

import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import { useTranslation } from "@/i18n/useTranslation";

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
  const polylinePositions = useMemo(
    () =>
      allPositions.map((p) => [p.latitude, p.longitude] as [number, number]),
    [allPositions]
  );
  const center = useMemo((): [number, number] => {
    if (lastPosition) {
      return [lastPosition.latitude, lastPosition.longitude];
    }
    if (allPositions.length > 0) {
      const last = allPositions[allPositions.length - 1];
      return [last.latitude, last.longitude];
    }
    return defaultCenter;
  }, [lastPosition, allPositions]);

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom
        className="h-full w-full rounded-md"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polylinePositions.length > 1 && (
          <Polyline positions={polylinePositions} color="#2563eb" weight={4} />
        )}
        <LastPositionMarker position={lastPosition ?? allPositions[allPositions.length - 1] ?? null} />
      </MapContainer>
    </div>
  );
}

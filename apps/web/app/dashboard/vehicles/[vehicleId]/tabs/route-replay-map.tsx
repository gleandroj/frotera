"use client";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PositionPoint } from "@/components/devices/device-map";

// Fix default Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MovingMarker({ positions, currentIdx }: { positions: PositionPoint[]; currentIdx: number }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (positions.length === 0) return;
    const pos = positions[currentIdx];
    if (!pos) return;

    if (!markerRef.current) {
      markerRef.current = L.marker([pos.latitude, pos.longitude]).addTo(map);
    } else {
      markerRef.current.setLatLng([pos.latitude, pos.longitude]);
    }
    map.panTo([pos.latitude, pos.longitude], { animate: false });
  }, [map, positions, currentIdx]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, []);

  return null;
}

interface Props {
  positions: PositionPoint[];
  currentIdx: number;
}

export function RouteReplayMap({ positions, currentIdx }: Props) {
  if (positions.length === 0) return null;

  const center = positions[0];
  const polylinePoints: [number, number][] = positions.map((p) => [p.latitude, p.longitude]);

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={polylinePoints} color="#3b82f6" weight={3} opacity={0.8} />
      <MovingMarker positions={positions} currentIdx={currentIdx} />
    </MapContainer>
  );
}

"use client";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ReferencePoint } from "@/lib/frontend/api-client";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const defaultCenter: [number, number] = [-15.77972, -47.92972];

function GeolocationInit() {
  const map = useMap();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 14),
      () => {},
      { timeout: 5000 },
    );
  }, [map]);

  return null;
}

function FlyToPoint({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!target) return;
    if (prev.current?.[0] === target[0] && prev.current?.[1] === target[1]) return;
    prev.current = target;
    map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [map, target]);

  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!onMapClick) return;
    const handleClick = (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [map, onMapClick]);

  return null;
}

function FormPreview({
  latitude,
  longitude,
  radiusMeters,
}: {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
}) {
  const map = useMap();
  const prev = useRef<{ lat?: number; lng?: number }>({});

  useEffect(() => {
    if (!latitude || !longitude) return;
    if (prev.current.lat === latitude && prev.current.lng === longitude) return;
    prev.current = { lat: latitude, lng: longitude };
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [map, latitude, longitude]);

  if (!latitude || !longitude) return null;

  return (
    <>
      <Marker position={[latitude, longitude]}>
        <Popup>Nova localização</Popup>
      </Marker>
      {!!radiusMeters && (
        <Circle
          center={[latitude, longitude]}
          radius={radiusMeters}
          color="#f97316"
          fill
          fillColor="#fdba74"
          fillOpacity={0.3}
          weight={2}
          dashArray="6 4"
        />
      )}
    </>
  );
}

interface Props {
  points: ReferencePoint[];
  onMapClick?: (lat: number, lng: number) => void;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  focusedPoint: [number, number] | null;
}

export function ReferencePointsMap({
  points,
  onMapClick,
  latitude,
  longitude,
  radiusMeters,
  focusedPoint,
}: Props) {
  const center =
    points.length > 0
      ? ([points[0].latitude, points[0].longitude] as [number, number])
      : defaultCenter;

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      className="rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <GeolocationInit />
      <FlyToPoint target={focusedPoint} />
      <MapClickHandler onMapClick={onMapClick} />

      {points.map((point) => (
        <Circle
          key={point.id}
          center={[point.latitude, point.longitude]}
          radius={point.radiusMeters}
          color={point.active ? "#3b82f6" : "#9ca3af"}
          fill
          fillColor={point.active ? "#93c5fd" : "#e5e7eb"}
          fillOpacity={0.3}
          weight={2}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-medium">{point.name}</p>
              {point.customer && (
                <p className="text-xs text-muted-foreground">{point.customer.name}</p>
              )}
              <p className="text-xs text-muted-foreground">Raio: {point.radiusMeters}m</p>
            </div>
          </Popup>
        </Circle>
      ))}

      <FormPreview latitude={latitude} longitude={longitude} radiusMeters={radiusMeters} />
    </MapContainer>
  );
}

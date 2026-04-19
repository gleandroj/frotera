"use client";

import { useEffect, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Truck } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { FleetVehicleStatus, FleetPosition } from "@/lib/frontend/api-client";
import type { FleetStreamPosition } from "@/lib/hooks/use-fleet-positions";

const DEFAULT_CENTER: [number, number] = [-15.77972, -47.92972];
const MARKER_SIZE = 40;

function markerColor(position: FleetPosition | FleetStreamPosition | null | undefined): string {
  if (!position) return "#6b7280";
  const age = Date.now() - new Date(position.recordedAt).getTime();
  const ageHours = age / 3_600_000;
  if (ageHours > 1) return "#f97316";
  const ignitionOn = (position as FleetPosition).ignitionOn;
  if (ignitionOn === true) return "#16a34a";
  if (ignitionOn === false) return "#6b7280";
  return "#2563eb";
}

function VehicleMarker({
  vehicle,
  position,
  selected,
  onClick,
}: {
  vehicle: FleetVehicleStatus;
  position: FleetPosition | FleetStreamPosition | null | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  if (!position) return null;

  const heading = (position as FleetPosition).heading ?? 0;
  const color = markerColor(position);
  const size = selected ? MARKER_SIZE + 8 : MARKER_SIZE;

  const icon = L.divIcon({
    className: "fleet-vehicle-marker",
    html: renderToStaticMarkup(
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          border: `3px solid ${selected ? "#fff" : "rgba(255,255,255,0.8)"}`,
          boxShadow: selected
            ? `0 0 0 3px ${color}, 0 4px 12px rgba(0,0,0,0.4)`
            : "0 2px 6px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            transform: `rotate(${heading}deg)`,
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Truck size={22} color="white" strokeWidth={2} />
        </div>
      </div>
    ),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  const label = vehicle.name ?? vehicle.plate ?? "—";
  const speed = position.speed != null ? `${Number(position.speed).toFixed(0)} km/h` : null;
  const lastUpdate = new Date(position.recordedAt).toLocaleString("pt-BR");

  return (
    <Marker
      position={[position.latitude, position.longitude]}
      icon={icon}
      zIndexOffset={selected ? 2000 : 1000}
      eventHandlers={{ click: onClick }}
    >
      <Popup>
        <div className="text-sm space-y-0.5 min-w-[140px]">
          <div className="font-semibold">{label}</div>
          {vehicle.plate && vehicle.name && (
            <div className="text-muted-foreground">{vehicle.plate}</div>
          )}
          {speed && <div>{speed}</div>}
          <div className="text-muted-foreground text-xs">{lastUpdate}</div>
        </div>
      </Popup>
    </Marker>
  );
}

function FlyToVehicle({
  position,
}: {
  position: [number, number] | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1.2 });
    }
  }, [map, position]);
  return null;
}

export interface FleetMapProps {
  vehicles: FleetVehicleStatus[];
  positionMap: Map<string, FleetStreamPosition>;
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}

export function FleetMap({ vehicles, positionMap, selectedVehicleId, onSelectVehicle }: FleetMapProps) {
  const flyToPosition = useMemo((): [number, number] | null => {
    if (!selectedVehicleId) return null;
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle?.trackerDevice) return null;
    const streamed = positionMap.get(vehicle.trackerDevice.id);
    const pos = streamed ?? vehicle.lastPosition;
    if (!pos) return null;
    return [pos.latitude, pos.longitude];
  }, [selectedVehicleId, vehicles, positionMap]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={5}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToVehicle position={flyToPosition} />
      {vehicles.map((vehicle) => {
        const deviceId = vehicle.trackerDevice?.id;
        const streamed = deviceId ? positionMap.get(deviceId) : undefined;
        const position = streamed ?? vehicle.lastPosition;
        return (
          <VehicleMarker
            key={vehicle.id}
            vehicle={vehicle}
            position={position}
            selected={vehicle.id === selectedVehicleId}
            onClick={() => onSelectVehicle(vehicle.id)}
          />
        );
      })}
    </MapContainer>
  );
}

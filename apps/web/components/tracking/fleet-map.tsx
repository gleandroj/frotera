"use client";

import { useEffect, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import { Truck } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { FleetVehicleStatus, FleetPosition } from "@/lib/frontend/api-client";
import type { FleetStreamPosition } from "@/lib/hooks/use-fleet-positions";

const DEFAULT_CENTER: [number, number] = [-15.77972, -47.92972];
const MARKER_SIZE = 40;

const STALE_MS = 5 * 60_000;

function isStalePosition(position: FleetPosition | FleetStreamPosition | null | undefined): boolean {
  const ts = (position as FleetStreamPosition)?.receivedAt ?? (position as FleetPosition)?.receivedAt ?? null;
  if (!ts) return true;
  return Date.now() - new Date(ts).getTime() > STALE_MS;
}

function markerColor(position: FleetPosition | FleetStreamPosition | null | undefined): string {
  if (!position) return "#6b7280";
  const age = Date.now() - new Date((position as FleetStreamPosition).receivedAt ?? position.recordedAt).getTime();
  const ageHours = age / 3_600_000;
  if (ageHours > 1) return "#f97316";
  const ignitionOn = (position as FleetPosition | FleetStreamPosition).ignitionOn;
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

  const heading = ((position as FleetPosition).heading ?? 0) - 90;
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
  const stale = isStalePosition(position);
  const speed = !stale && position.speed != null ? `${Number(position.speed).toFixed(0)} km/h` : "—";
  const pos = position as FleetPosition & FleetStreamPosition;
  const receivedTs = pos.receivedAt ?? null;
  const lastUpdate = receivedTs
    ? new Date(receivedTs).toLocaleString("pt-BR")
    : new Date(position.recordedAt).toLocaleString("pt-BR");
  const totalOdometer = ((vehicle.initialOdometerKm ?? 0) + (pos.odometerKm ?? 0));
  const odometerStr = `${totalOdometer.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`;

  return (
    <Marker
      position={[position.latitude, position.longitude]}
      icon={icon}
      zIndexOffset={selected ? 2000 : 1000}
      eventHandlers={{ click: onClick }}
    >
      <Popup>
        <div className="text-sm space-y-1 min-w-[180px]">
          <div className="font-semibold">{label}</div>
          {vehicle.plate && vehicle.name && (
            <div className="text-muted-foreground">{vehicle.plate}</div>
          )}
          <div className="text-xs text-muted-foreground font-mono">
            {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
          </div>
          <div className="border-t border-border/40 pt-1 space-y-0.5">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Velocidade</span>
              <span className={stale ? "text-muted-foreground" : ""}>{speed}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Ignição</span>
              <span className={pos.ignitionOn === true ? "text-green-600" : "text-muted-foreground"}>
                {pos.ignitionOn === true ? "Ligada" : pos.ignitionOn === false ? "Desligada" : "—"}
              </span>
            </div>
            {pos.voltageLevel != null && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tensão</span>
                <span>{pos.voltageLevel} V</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Hodômetro</span>
              <span>{odometerStr}</span>
            </div>
            {pos.city && (
              <div className="text-xs text-muted-foreground truncate max-w-[180px]" title={pos.city}>
                {pos.city}
              </div>
            )}
          </div>
          <div className="text-muted-foreground text-xs border-t border-border/40 pt-1">{lastUpdate}</div>
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
      zoomControl={false}
      className="h-full w-full"
    >
      <ZoomControl position="bottomleft" />
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

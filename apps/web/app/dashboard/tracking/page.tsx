"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, ChevronLeft, ChevronRight, ClipboardList, Fuel, Search } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { vehiclesAPI, type FleetVehicleStatus } from "@/lib/frontend/api-client";
import { useFleetPositions } from "@/lib/hooks/use-fleet-positions";
import { useTranslation } from "@/i18n/useTranslation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FleetMapProps } from "@/components/tracking/fleet-map";

const FleetMapDynamic = dynamic<FleetMapProps>(
  () => import("@/components/tracking/fleet-map").then((m) => ({ default: m.FleetMap })),
  { ssr: false },
);

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

export default function TrackingPage() {
  const { t } = useTranslation();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const canView = can(Module.TRACKING, Action.VIEW);

  const [vehicles, setVehicles] = useState<FleetVehicleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const orgId = currentOrganization?.id ?? null;

  const deviceIds = useMemo(
    () => vehicles.flatMap((v) => (v.trackerDevice?.id ? [v.trackerDevice.id] : [])),
    [vehicles],
  );

  const { positionMap } = useFleetPositions(deviceIds, orgId);

  const load = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    vehiclesAPI
      .fleetStatus(orgId, { customerId: selectedCustomerId })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : []
        setVehicles(data);
      })
      .catch(() => setVehicles([]))
      .finally(() => setLoading(false));
  }, [orgId, selectedCustomerId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.plate?.toLowerCase().includes(q) ||
        v.name?.toLowerCase().includes(q),
    );
  }, [vehicles, search]);

  if (!canView) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t("common.forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <FleetMapDynamic
        vehicles={vehicles}
        positionMap={positionMap}
        selectedVehicleId={selectedId}
        onSelectVehicle={setSelectedId}
      />

      {/* Floating vehicle panel */}
      <div
        className={`absolute top-3 left-3 z-[400] flex flex-col transition-all duration-200 ${panelOpen ? "w-72" : "w-10"
          }`}
      >
        {panelOpen ? (
          <div className="rounded-xl border border-border/60 bg-background/95 shadow-lg backdrop-blur-sm flex flex-col max-h-[calc(100svh-5rem)] overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-border/40">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="h-8 pl-7 text-sm"
                  placeholder={t("tracking.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setPanelOpen(false)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* Vehicle count */}
            <div className="px-3 py-1.5 text-xs text-muted-foreground">
              {loading ? t("common.loading") : `${filtered.length} veículo(s)`}
            </div>

            {/* Vehicle list */}
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 && !loading && (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {t("tracking.noVehicles")}
                </p>
              )}
              {filtered.map((vehicle) => {
                const deviceId = vehicle.trackerDevice?.id;
                const streamed = deviceId ? positionMap.get(deviceId) : undefined;
                const position = streamed ?? vehicle.lastPosition;
                const isSelected = vehicle.id === selectedId;
                const ignitionOn = (position as typeof vehicle.lastPosition)?.ignitionOn;

                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    className={`w-full text-left px-3 py-2.5 border-b border-border/30 hover:bg-muted/50 transition-colors ${isSelected ? "bg-muted" : ""
                      }`}
                    onClick={() => setSelectedId(isSelected ? null : vehicle.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">
                          {vehicle.name ?? vehicle.plate ?? "—"}
                        </div>
                        {vehicle.name && vehicle.plate && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {vehicle.plate}
                          </div>
                        )}
                      </div>
                      {vehicle.trackerDevice ? (
                        <Badge
                          variant="secondary"
                          className={`text-xs shrink-0 ${ignitionOn === true
                            ? "bg-green-500/15 text-green-700 dark:text-green-400"
                            : ignitionOn === false
                              ? "bg-muted text-muted-foreground"
                              : "bg-muted text-muted-foreground"
                            }`}
                        >
                          {ignitionOn === true
                            ? t("tracking.ignitionOn")
                            : ignitionOn === false
                              ? t("tracking.ignitionOff")
                              : position
                                ? t("tracking.ignitionOff")
                                : t("tracking.noPosition")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">
                          {t("tracking.noTracker")}
                        </Badge>
                      )}
                    </div>

                    {position && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t("tracking.lastUpdate")}: {formatRelativeTime(position.recordedAt)}
                        {position.speed != null && position.speed > 0 && (
                          <span className="ml-2">{Number(position.speed).toFixed(0)} km/h</span>
                        )}
                      </div>
                    )}

                    {/* Quick links */}
                    <div className="mt-1.5 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/vehicles/${vehicle.id}`}
                        title={t("tracking.viewVehicle")}
                        className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Car className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={`/dashboard/fuel?vehicleId=${vehicle.id}`}
                        title={t("tracking.viewFuel")}
                        className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Fuel className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={`/dashboard/checklist?vehicleId=${vehicle.id}`}
                        title={t("tracking.viewChecklist")}
                        className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-xl shadow-lg"
            onClick={() => setPanelOpen(true)}
            title={t("tracking.expand")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

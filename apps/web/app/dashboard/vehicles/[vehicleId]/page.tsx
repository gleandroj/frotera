"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/hooks/use-auth";
import { vehiclesAPI, trackerDevicesAPI } from "@/lib/frontend/api-client";
import { useTrackerPositions } from "@/lib/hooks/use-tracker-positions";
import type { PositionPoint } from "@/components/devices/device-map";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/i18n/useTranslation";
import { Badge } from "@/components/ui/badge";
import type { Vehicle } from "@/lib/frontend/api-client";

const DeviceMapDynamic = dynamic(
  () =>
    import("@/components/devices/device-map").then((mod) => ({
      default: mod.DeviceMap,
    })),
  { ssr: false }
);

interface ApiPosition {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  recordedAt: string;
  createdAt: string;
}

function toPositionPoint(p: ApiPosition): PositionPoint {
  return {
    latitude: p.latitude,
    longitude: p.longitude,
    altitude: p.altitude ?? null,
    speed: p.speed ?? null,
    heading: p.heading ?? null,
    recordedAt: p.recordedAt,
  };
}

export default function VehicleDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const vehicleId = typeof params?.vehicleId === "string" ? params.vehicleId : null;
  const { currentOrganization } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [initialHistory, setInitialHistory] = useState<PositionPoint[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const deviceId = vehicle?.trackerDevice?.id ?? null;

  const {
    positions: streamedPositions,
    lastPosition: streamLastPosition,
    connected,
  } = useTrackerPositions(deviceId, currentOrganization?.id ?? null);

  const streamedAsPoints = useMemo(
    () => streamedPositions as PositionPoint[],
    [streamedPositions]
  );
  const lastPosition = useMemo((): PositionPoint | null => {
    if (streamLastPosition) return streamLastPosition as PositionPoint;
    if (initialHistory.length > 0)
      return initialHistory[initialHistory.length - 1] ?? null;
    return null;
  }, [streamLastPosition, initialHistory]);

  useEffect(() => {
    if (!vehicleId || !currentOrganization?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    vehiclesAPI
      .get(currentOrganization.id, vehicleId)
      .then((res) => {
        if (cancelled) return;
        const v = res.data as Vehicle;
        setVehicle(v);
        if (v?.trackerDevice?.id) {
          return trackerDevicesAPI.getPositionHistory(
            currentOrganization.id!,
            v.trackerDevice.id,
            { limit: 100 }
          ).then((historyRes) => {
            if (cancelled) return;
            const list = Array.isArray(historyRes.data) ? historyRes.data : [];
            setInitialHistory(list.map((p: ApiPosition) => toPositionPoint(p)));
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err?.response?.data?.message ?? t("common.error"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, currentOrganization?.id, t]);

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          {t("vehicles.selectOrganization")}
        </p>
      </div>
    );
  }

  if (!vehicleId) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">{t("vehicles.vehicleNotFound")}</p>
      </div>
    );
  }

  const displayName = vehicle?.name ?? vehicle?.plate ?? t("vehicles.vehicle");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/vehicles">{t("vehicles.backToVehicles")}</Link>
          </Button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {displayName}
          </h1>
        </div>
      </div>

      {loadError && (
        <p className="text-destructive">{loadError}</p>
      )}

      {loading && (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      )}

      {!loading && !loadError && vehicle && (
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="info">{t("vehicles.tabs.info")}</TabsTrigger>
            <TabsTrigger value="tracking">{t("vehicles.tabs.tracking")}</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="mt-6">
            <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
              <h2 className="text-lg font-semibold mb-4">
                {t("vehicles.vehicleInformation")}
              </h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">{t("common.name")}</dt>
                  <dd className="mt-1">{vehicle.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("vehicles.plate")}</dt>
                  <dd className="mt-1 font-medium">{vehicle.plate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("vehicles.device")}</dt>
                  <dd className="mt-1">
                    {vehicle.trackerDevice ? (
                      <div className="space-y-1">
                        <span className="font-mono text-sm">
                          {vehicle.trackerDevice.imei}
                        </span>
                        <span className="text-muted-foreground text-sm ml-1">
                          ({vehicle.trackerDevice.model})
                        </span>
                        {vehicle.trackerDevice.name && (
                          <span className="block text-sm text-muted-foreground">
                            {vehicle.trackerDevice.name}
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {vehicle.trackerDevice.connectedAt ? (
                            <Badge variant="default" className="text-green-600 bg-green-500/20">
                              {t("devices.connected")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              {t("devices.disconnected")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("vehicles.noDevice")}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("common.created")}</dt>
                  <dd className="mt-1 text-sm">
                    {vehicle.createdAt
                      ? new Date(vehicle.createdAt).toLocaleString()
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </TabsContent>
          <TabsContent value="tracking" className="mt-6">
            {vehicle.trackerDevice ? (
              <>
                <p className="text-muted-foreground text-sm mb-4">
                  {connected ? (
                    <span className="text-green-600">{t("devices.connected")}</span>
                  ) : (
                    <span className="text-amber-600">{t("devices.disconnected")}</span>
                  )}
                  {lastPosition && (
                    <>
                      {" · "}
                      {t("devices.lastUpdate")}:{" "}
                      {new Date(lastPosition.recordedAt).toLocaleString()}
                    </>
                  )}
                </p>
                <DeviceMapDynamic
                  key={deviceId!}
                  initialPositions={initialHistory}
                  streamedPositions={streamedAsPoints}
                  lastPosition={lastPosition}
                />
                {initialHistory.length === 0 && streamedAsPoints.length === 0 && (
                  <p className="text-muted-foreground mt-4">
                    {t("devices.noPositionYet")}
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                {t("vehicles.noDeviceTracking")}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

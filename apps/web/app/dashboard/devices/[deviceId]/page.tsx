"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/hooks/use-auth";
import { trackerDevicesAPI } from "@/lib/frontend/api-client";
import { useTrackerPositions } from "@/lib/hooks/use-tracker-positions";
import type { PositionPoint } from "@/components/devices/device-map";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/useTranslation";

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

export default function DeviceLivePage() {
  const { t } = useTranslation();
  const params = useParams();
  const deviceId = typeof params?.deviceId === "string" ? params.deviceId : null;
  const { currentOrganization } = useAuth();
  const [initialHistory, setInitialHistory] = useState<PositionPoint[]>([]);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!deviceId || !currentOrganization?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      trackerDevicesAPI.get(currentOrganization.id, deviceId),
      trackerDevicesAPI.getPositionHistory(currentOrganization.id, deviceId, {
        limit: 100,
      }),
    ])
      .then(([deviceRes, historyRes]) => {
        if (cancelled) return;
        const device = deviceRes.data as { name?: string | null };
        setDeviceName(device?.name ?? null);
        const list = Array.isArray(historyRes.data) ? historyRes.data : [];
        setInitialHistory(list.map((p: ApiPosition) => toPositionPoint(p)));
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
  }, [deviceId, currentOrganization?.id, t]);

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          {t("devices.selectOrganizationDevice")}
        </p>
      </div>
    );
  }

  if (!deviceId) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">{t("devices.deviceNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/devices">{t("devices.backToDevices")}</Link>
          </Button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {deviceName ?? t("devices.device")} — {t("devices.realtime")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {connected ? (
              <span className="text-green-600">{t("devices.connected")}</span>
            ) : (
              <span className="text-amber-600">{t("devices.disconnected")}</span>
            )}
            {lastPosition && (
              <> · {t("devices.lastUpdate")}: {new Date(lastPosition.recordedAt).toLocaleString()}</>
            )}
          </p>
        </div>
      </div>

      {loadError && (
        <p className="text-destructive">{loadError}</p>
      )}

      {loading && (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      )}

      {!loading && !loadError && (
        <DeviceMapDynamic
          initialPositions={initialHistory}
          streamedPositions={streamedAsPoints}
          lastPosition={lastPosition}
        />
      )}

      {!loading && !loadError && initialHistory.length === 0 && streamedAsPoints.length === 0 && (
        <p className="text-muted-foreground">
          {t("devices.noPositionYet")}
        </p>
      )}
    </div>
  );
}

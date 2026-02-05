"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { trackerDevicesAPI } from "@/lib/frontend/api-client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/useTranslation";

interface TrackerDevice {
  id: string;
  organizationId: string;
  imei: string;
  model: string;
  name?: string | null;
  vehicleId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DevicesPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const [devices, setDevices] = useState<TrackerDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    trackerDevicesAPI
      .list(currentOrganization.id)
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) {
          setDevices(res.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message ?? t("common.error"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, t]);

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("navigation.items.devices")}
        </h1>
        <p className="text-muted-foreground">
          {t("devices.selectOrganization")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("navigation.items.devices")}
        </h1>
        <p className="text-muted-foreground">
          {t("devices.listDescription")}
        </p>
      </div>

      {loading && (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      )}
      {error && (
        <p className="text-destructive">{error}</p>
      )}
      {!loading && !error && devices.length === 0 && (
        <p className="text-muted-foreground">
          {t("devices.noDevices")}
        </p>
      )}
      {!loading && !error && devices.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("devices.imei")}</TableHead>
                <TableHead>{t("devices.model")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>
                    {device.name ?? t("common.notAvailable")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {device.imei}
                  </TableCell>
                  <TableCell>{device.model}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/devices/${device.id}`}>
                        {t("devices.viewLive")}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { trackerDevicesAPI } from "@/lib/frontend/api-client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/useTranslation";
import { DataTable } from "@/components/ui/data-table";
import { getDeviceColumns } from "./columns";
import { DeviceFormDialog } from "./device-form-dialog";
import { DeleteDeviceDialog } from "./delete-device-dialog";

interface TrackerDevice {
  id: string;
  organizationId: string;
  imei: string;
  model: string;
  name?: string | null;
  serialSat?: string | null;
  equipmentModel?: string | null;
  individualPassword?: string | null;
  carrier?: string | null;
  simCardNumber?: string | null;
  cellNumber?: string | null;
  vehicleId?: string | null;
  connectedAt?: string | null;
  odometerSource?: string;
  createdAt: string;
  updatedAt: string;
}

export default function DevicesPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const [devices, setDevices] = useState<TrackerDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<TrackerDevice | null>(null);
  const [deleteDevice, setDeleteDevice] = useState<TrackerDevice | null>(null);

  const loadDevices = () => {
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
  };

  useEffect(() => {
    loadDevices();
  }, [currentOrganization?.id, t]);

  const handleSuccess = () => {
    setEditDevice(null);
    setDeleteDevice(null);
    loadDevices();
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("navigation.items.devices")}
          </h1>
          <p className="text-muted-foreground">
            {t("devices.listDescription")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          {t("devices.createDevice")}
        </Button>
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
        <DataTable<TrackerDevice, unknown>
          columns={getDeviceColumns(t, {
            onEdit: (device: any) => setEditDevice(device),
            onDelete: (device: any) => setDeleteDevice(device),
          })}
          data={devices}
          filterPlaceholder={t("common.search")}
          filterColumnId="name"
          noResultsLabel={t("devices.noResults") || "Nenhum resultado encontrado"}
        />
      )}

      <DeviceFormDialog
        open={createOpen || !!editDevice}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditDevice(null);
          }
        }}
        device={editDevice}
        organizationId={currentOrganization?.id || ""}
        onSuccess={handleSuccess}
      />

      <DeleteDeviceDialog
        open={!!deleteDevice}
        onOpenChange={(open) => {
          if (!open) setDeleteDevice(null);
        }}
        device={deleteDevice}
        organizationId={currentOrganization?.id || ""}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

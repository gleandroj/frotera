"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/use-auth";
import { Action, Module, usePermissions } from "@/lib/hooks/use-permissions";
import {
  telemetryAPI,
  type GeofenceZone,
} from "@/lib/frontend/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useTranslation } from "@/i18n/useTranslation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { GeofenceFormDialog } from "../components/geofence-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  RecordStatusFilter,
  RECORD_STATUS_ALL,
  listParamsForRecordStatus,
  type RecordListStatus,
} from "@/components/list-filters/record-status-filter";
import { getGeofenceColumns } from "./columns";

export default function GeofencesPage() {
  const { t } = useTranslation();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const canEdit = can(Module.TELEMETRY, Action.EDIT);
  const canDelete = can(Module.TELEMETRY, Action.DELETE);
  const orgId = currentOrganization?.id;

  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GeofenceZone | null>(null);
  const [deleting, setDeleting] = useState<GeofenceZone | null>(null);
  const [listStatus, setListStatus] = useState<RecordListStatus>(RECORD_STATUS_ALL);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await telemetryAPI.listGeofences(
        orgId,
        listParamsForRecordStatus(listStatus, selectedCustomerId ?? undefined),
      );
      setZones(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(getApiErrorMessage(e, t, "common.error"));
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedCustomerId, listStatus, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(
    () =>
      getGeofenceColumns(t, {
        canEdit,
        canDelete,
        onEdit: (z) => {
          setEditing(z);
          setFormOpen(true);
        },
        onDelete: setDeleting,
      }),
    [t, canEdit, canDelete],
  );

  const confirmDelete = async () => {
    if (!orgId || !deleting) return;
    try {
      await telemetryAPI.deleteGeofence(orgId, deleting.id);
      toast.success(t("telemetry.geofences.deleteSuccess"));
      setDeleting(null);
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t, "common.error"));
    }
  };

  if (!orgId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("vehicles.selectOrganization")}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("telemetry.geofences.title")}
          </h1>
          <p className="text-muted-foreground">{t("telemetry.geofences.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/telemetry">{t("telemetry.geofences.backToAlerts")}</Link>
          </Button>
          {canEdit && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              {t("telemetry.geofences.newZone")}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <DataTable<GeofenceZone, unknown>
          columns={columns}
          data={zones}
          filterPlaceholder={t("common.search")}
          filterColumnId="name"
          noResultsLabel={
            zones.length === 0
              ? t("telemetry.geofences.noZones")
              : t("common.noResults")
          }
          toolbarLeading={
            <RecordStatusFilter
              id="geofences-list-status"
              value={listStatus}
              onValueChange={setListStatus}
            />
          }
        />
      )}

      <GeofenceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        organizationId={orgId}
        customerId={selectedCustomerId}
        zone={editing}
        onSaved={() => void load()}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("telemetry.geofences.deleteZone")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("telemetry.geofences.deleteConfirm", {
                name: deleting?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t("common.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

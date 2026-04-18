"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await telemetryAPI.listGeofences(orgId, {
        customerId: selectedCustomerId ?? undefined,
      });
      setZones(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(getApiErrorMessage(e, t, "common.error"));
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedCustomerId, t]);

  useEffect(() => {
    void load();
  }, [load]);

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("telemetry.geofences.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("telemetry.geofences.columns.name")}</TableHead>
                  <TableHead>{t("telemetry.geofences.columns.type")}</TableHead>
                  <TableHead>{t("telemetry.geofences.columns.status")}</TableHead>
                  <TableHead>{t("telemetry.geofences.columns.alertOnEnter")}</TableHead>
                  <TableHead>{t("telemetry.geofences.columns.alertOnExit")}</TableHead>
                  <TableHead className="text-right">
                    {t("telemetry.geofences.columns.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6}>…</TableCell>
                  </TableRow>
                ) : zones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t("telemetry.geofences.noZones")}
                    </TableCell>
                  </TableRow>
                ) : (
                  zones.map((z) => (
                    <TableRow key={z.id}>
                      <TableCell className="font-medium">{z.name}</TableCell>
                      <TableCell>{z.type}</TableCell>
                      <TableCell>
                        {z.active ? t("common.yes") : t("common.no")}
                      </TableCell>
                      <TableCell>
                        {z.alertOnEnter ? t("common.yes") : t("common.no")}
                      </TableCell>
                      <TableCell>
                        {z.alertOnExit ? t("common.yes") : t("common.no")}
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing(z);
                              setFormOpen(true);
                            }}
                          >
                            {t("telemetry.geofences.editZone")}
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleting(z)}
                          >
                            {t("telemetry.geofences.deleteZone")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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

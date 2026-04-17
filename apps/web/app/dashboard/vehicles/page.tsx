"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { vehiclesAPI, type Vehicle } from "@/lib/frontend/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { getVehicleColumns } from "./columns";
import { VehicleFormDialog } from "./vehicle-form-dialog";
import { DeleteVehicleDialog } from "./delete-vehicle-dialog";

export default function VehiclesPage() {
  const { t } = useTranslation();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const canEditVehicle = can(Module.VEHICLES, Action.EDIT);
  const canDeleteVehicle = can(Module.VEHICLES, Action.DELETE);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<Vehicle | null>(null);

  const fetchVehicles = useCallback(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    vehiclesAPI
      .list(currentOrganization.id, {
        customerId: selectedCustomerId ?? undefined,
      })
      .then((res) => {
        if (Array.isArray(res.data)) setVehicles(res.data);
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, t));
      })
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, selectedCustomerId, t]);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    fetchVehicles();
  }, [currentOrganization?.id, fetchVehicles]);

  const columns = useMemo(
    () =>
      getVehicleColumns(t, {
        onEdit: setEditVehicle,
        onDelete: setDeleteVehicle,
        canEditVehicle,
        canDeleteVehicle,
      }),
    [t, canEditVehicle, canDeleteVehicle],
  );

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("navigation.items.vehicles")}
        </h1>
        <p className="text-muted-foreground">
          {t("vehicles.selectOrganization")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("navigation.items.vehicles")}
          </h1>
          <p className="text-muted-foreground">
            {t("vehicles.listDescription")}
          </p>
        </div>
        {(currentOrganization?.role?.permissions?.some((p: any) => p.module === "VEHICLES" && p.actions.includes("CREATE")) ?? false) && (
          <Button onClick={() => setCreateOpen(true)}>
            {t("vehicles.createVehicle")}
          </Button>
        )}
      </div>

      {loading && (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      )}
      {error && (
        <p className="text-destructive">{error}</p>
      )}
      {!loading && !error && vehicles.length === 0 && (
        <p className="text-muted-foreground">
          {t("vehicles.noVehicles")}
        </p>
      )}
      {!loading && !error && vehicles.length > 0 && (
        <DataTable<Vehicle, unknown>
          columns={columns}
          data={vehicles}
          filterPlaceholder={t("vehicles.filterByName")}
          filterColumnId="name"
          noResultsLabel={t("vehicles.noResults")}
        />
      )}

      <VehicleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        vehicle={null}
        organizationId={currentOrganization.id}
        onSuccess={fetchVehicles}
        defaultCustomerId={selectedCustomerId ?? undefined}
      />
      <VehicleFormDialog
        open={!!editVehicle}
        onOpenChange={(open) => !open && setEditVehicle(null)}
        vehicle={editVehicle ?? null}
        organizationId={currentOrganization.id}
        onSuccess={fetchVehicles}
        defaultCustomerId={selectedCustomerId ?? undefined}
      />
      <DeleteVehicleDialog
        open={!!deleteVehicle}
        onOpenChange={(open) => !open && setDeleteVehicle(null)}
        vehicle={deleteVehicle}
        organizationId={currentOrganization.id}
        onSuccess={fetchVehicles}
      />
    </div>
  );
}

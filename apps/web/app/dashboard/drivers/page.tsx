"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { useAuth } from "@/lib/hooks/use-auth";
import { driversAPI, type Driver } from "@/lib/frontend/api-client";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getDriverColumns } from "./columns";
import { DriverFormDialog } from "./driver-form-dialog";
import { DeleteDriverDialog } from "./delete-driver-dialog";
import { ActiveOnlyFilter } from "@/components/list-filters/active-only-filter";

export default function DriversPage() {
  const { t } = useTranslation();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [deleteDriver, setDeleteDriver] = useState<Driver | null>(null);

  const fetchDrivers = useCallback(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    driversAPI
      .list(currentOrganization.id, {
        customerId: selectedCustomerId ?? undefined,
        activeOnly: activeOnly ? true : undefined,
      })
      .then((res) => setDrivers(res.data?.drivers ?? []))
      .catch((err) => setError(err?.response?.data?.message ?? t("common.error")))
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, selectedCustomerId, activeOnly, t]);

  useEffect(() => {
    if (!currentOrganization?.id) { setLoading(false); return; }
    fetchDrivers();
  }, [currentOrganization?.id, fetchDrivers]);

  const columns = useMemo(
    () => getDriverColumns(t, { onEdit: setEditDriver, onDelete: setDeleteDriver }),
    [t],
  );

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("navigation.items.drivers")}
        </h1>
        <p className="text-muted-foreground">{t("drivers.selectOrganization")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("navigation.items.drivers")}
          </h1>
          <p className="text-muted-foreground">{t("drivers.listDescription")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("drivers.createDriver")}
        </Button>
      </div>

      <ActiveOnlyFilter
        id="drivers-active-only"
        checked={activeOnly}
        onCheckedChange={setActiveOnly}
      />

      {loading && (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
      {!loading && !error && drivers.length === 0 && (
        <p className="text-muted-foreground">{t("drivers.noDrivers")}</p>
      )}
      {!loading && !error && drivers.length > 0 && (
        <DataTable
          columns={columns}
          data={drivers}
          filterColumnId="name"
          filterPlaceholder={t("drivers.filterByName")}
        />
      )}

      <DriverFormDialog
        open={createOpen || !!editDriver}
        onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditDriver(null); } }}
        driver={editDriver}
        organizationId={currentOrganization.id}
        onSuccess={fetchDrivers}
        defaultCustomerId={selectedCustomerId}
      />

      <DeleteDriverDialog
        driver={deleteDriver}
        organizationId={currentOrganization.id}
        onOpenChange={(o) => { if (!o) setDeleteDriver(null); }}
        onSuccess={fetchDrivers}
      />
    </div>
  );
}

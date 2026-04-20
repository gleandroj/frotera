"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import {
  fuelAPI,
  type FuelListParams,
  type FuelLog,
  type FuelStats,
} from "@/lib/frontend/api-client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { FuelStatsCards } from "./components/fuel-stats-cards";
import { getFuelColumns } from "./components/fuel-columns";
import { DeleteFuelDialog } from "./components/delete-fuel-dialog";
import { FuelFormDrawer } from "./components/fuel-form-drawer";
import { FuelFiltersBar } from "./components/fuel-filters-bar";
import { rangeForFuelPreset, type FuelDatePresetKey } from "./components/fuel-date-range";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function FuelPage() {
  const { t } = useTranslation();
  const intlLocale = useIntlLocale();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const canCreateFuel = can(Module.FUEL, Action.CREATE);
  const canEditFuel = can(Module.FUEL, Action.EDIT);
  const canDeleteFuel = can(Module.FUEL, Action.DELETE);

  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [stats, setStats] = useState<FuelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editLog, setEditLog] = useState<FuelLog | null>(null);
  const [deleteLog, setDeleteLog] = useState<FuelLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [filterVehicleId, setFilterVehicleId] = useState("");
  const [filterDriverId, setFilterDriverId] = useState("");
  const [datePreset, setDatePreset] = useState<FuelDatePresetKey>("thisMonth");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");

  const listParams = useMemo((): FuelListParams => {
    const p: FuelListParams = {};
    if (filterVehicleId) p.vehicleId = filterVehicleId;
    if (filterDriverId) p.driverId = filterDriverId;
    const { from, to } = rangeForFuelPreset(
      datePreset,
      customDateFrom,
      customDateTo,
    );
    p.dateFrom = from.toISOString();
    p.dateTo = to.toISOString();
    return p;
  }, [filterVehicleId, filterDriverId, datePreset, customDateFrom, customDateTo]);

  const loadData = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      setLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        fuelAPI.list(currentOrganization.id, listParams),
        fuelAPI.getStats(currentOrganization.id, listParams),
      ]);
      setLogs(logsRes.data);
      setStats(statsRes.data);
    } catch {
      toast.error(t("fuel.toastError"));
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, listParams, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!deleteLog || !currentOrganization?.id) return;
    try {
      setDeleting(true);
      await fuelAPI.delete(currentOrganization.id, deleteLog.id);
      setLogs((prev) => prev.filter((l) => l.id !== deleteLog.id));
      setDeleteLog(null);
      toast.success(t("fuel.toastDeleted"));
    } catch {
      toast.error(t("fuel.toastError"));
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo(
    () =>
      getFuelColumns({
        onEdit: setEditLog,
        onDelete: setDeleteLog,
        t,
        intlLocale,
        canEdit: canEditFuel,
        canDelete: canDeleteFuel,
      }),
    [t, intlLocale, canEditFuel, canDeleteFuel],
  );

  if (!currentOrganization?.id) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{t("fuel.title")}</h1>
        <div className="text-center text-muted-foreground">
          {t("common.selectOrganization")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("fuel.title")}</h1>
          <p className="text-muted-foreground">{t("fuel.listDescription")}</p>
        </div>
        {canCreateFuel && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("fuel.newLog")}
          </Button>
        )}
      </div>

      <FuelStatsCards stats={stats} />

      <FuelFiltersBar
        organizationId={currentOrganization.id}
        selectedCustomerId={selectedCustomerId}
        filterVehicleId={filterVehicleId}
        filterDriverId={filterDriverId}
        preset={datePreset}
        customFrom={customDateFrom}
        customTo={customDateTo}
        onVehicleChange={setFilterVehicleId}
        onDriverChange={setFilterDriverId}
        onPresetChange={setDatePreset}
        onCustomFromChange={setCustomDateFrom}
        onCustomToChange={setCustomDateTo}
      />

      {loading ? (
        <div className="text-center text-muted-foreground">{t("common.loading")}</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-muted-foreground">{t("fuel.noLogs")}</div>
      ) : (
        <DataTable
          columns={columns}
          data={logs}
          initialSorting={[{ id: "date", desc: true }]}
          initialColumnVisibility={{ station: false }}
          tableClassName="min-w-[640px] sm:min-w-0"
        />
      )}

      <FuelFormDrawer
        open={createOpen || !!editLog}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditLog(null);
          }
        }}
        log={editLog}
        organizationId={currentOrganization.id}
        onSuccess={loadData}
      />

      <DeleteFuelDialog
        open={!!deleteLog}
        onOpenChange={(o) => { if (!o) setDeleteLog(null); }}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

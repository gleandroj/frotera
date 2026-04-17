"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelAPI, type FuelLog, type FuelStats } from "@/lib/frontend/api-client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { FuelStatsCards } from "./components/fuel-stats-cards";
import { getFuelColumns } from "./components/fuel-columns";
import { DeleteFuelDialog } from "./components/delete-fuel-dialog";
import { FuelFormDrawer } from "./components/fuel-form-drawer";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function FuelPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();

  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [stats, setStats] = useState<FuelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editLog, setEditLog] = useState<FuelLog | null>(null);
  const [deleteLog, setDeleteLog] = useState<FuelLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    try {
      setLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        fuelAPI.list(currentOrganization.id),
        fuelAPI.getStats(currentOrganization.id),
      ]);
      setLogs(logsRes.data);
      setStats(statsRes.data);
    } catch {
      toast.error(t("fuel.toastError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentOrganization?.id]);

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

  const columns = getFuelColumns({
    onEdit: setEditLog,
    onDelete: setDeleteLog,
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("fuel.title")}</h1>
          <p className="text-muted-foreground">{t("fuel.listDescription")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("fuel.newLog")}
        </Button>
      </div>

      <FuelStatsCards stats={stats} />

      {loading ? (
        <div className="text-center text-muted-foreground">{t("common.loading")}</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-muted-foreground">{t("fuel.noLogs")}</div>
      ) : (
        <DataTable columns={columns} data={logs} />
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelAPI, FuelLog, FuelStats } from "@/lib/frontend/api-client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { FuelStatsCards } from "./components/fuel-stats-cards";
import { getFuelColumns } from "./components/fuel-columns";
import { DeleteFuelDialog } from "./components/delete-fuel-dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function FuelPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentOrganization } = useAuth();

  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [stats, setStats] = useState<FuelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Load data
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [logsRes, statsRes] = await Promise.all([
          fuelAPI.list(currentOrganization.id),
          fuelAPI.getStats(currentOrganization.id),
        ]);
        setLogs(logsRes.data);
        setStats(statsRes.data);
      } catch (err) {
        console.error('Failed to load fuel logs:', err);
        toast.error(t('fuel.toastError'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentOrganization?.id, t]);

  const handleEdit = (id: string) => {
    router.push(`/dashboard/fuel/${id}`);
  };

  const handleDelete = async () => {
    if (!deleteId || !currentOrganization?.id) return;

    try {
      setDeleting(true);
      await fuelAPI.delete(currentOrganization.id, deleteId);
      setLogs(logs.filter(log => log.id !== deleteId));
      setShowDeleteDialog(false);
      toast.success(t('fuel.toastDeleted'));
    } catch (err) {
      console.error('Failed to delete fuel log:', err);
      toast.error(t('fuel.toastError'));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const columns = getFuelColumns({
    onEdit: handleEdit,
    onDelete: (id: string) => {
      setDeleteId(id);
      setShowDeleteDialog(true);
    },
  });

  if (!currentOrganization?.id) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('fuel.title')}</h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t('common.selectOrganization')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('fuel.title')}</h1>
          <p className="text-muted-foreground">{t('fuel.listDescription')}</p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/fuel/new')}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('fuel.newLog')}
        </Button>
      </div>

      <FuelStatsCards stats={stats} />

      {loading ? (
        <div className="text-center text-muted-foreground">
          {t('common.loading')}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center text-muted-foreground">
          {t('fuel.noLogs')}
        </div>
      ) : (
        <DataTable columns={columns} data={logs} />
      )}

      <DeleteFuelDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

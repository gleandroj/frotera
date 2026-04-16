"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelAPI, FuelLog, UpdateFuelLogPayload } from "@/lib/frontend/api-client";
import { FuelForm } from "../components/fuel-form";
import { DeleteFuelDialog } from "../components/delete-fuel-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";

export default function EditFuelPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { currentOrganization } = useAuth();
  const id = params.id as string;

  const [log, setLog] = useState<FuelLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Load fuel log
  useEffect(() => {
    if (!currentOrganization?.id || !id) return;

    const loadLog = async () => {
      try {
        setLoading(true);
        const res = await fuelAPI.get(currentOrganization.id, id);
        setLog(res.data);
      } catch (err) {
        console.error('Failed to load fuel log:', err);
        toast.error(t('fuel.toastError'));
        router.push('/dashboard/fuel');
      } finally {
        setLoading(false);
      }
    };

    loadLog();
  }, [currentOrganization?.id, id, router, t]);

  const handleSubmit = async (payload: UpdateFuelLogPayload) => {
    if (!currentOrganization?.id || !id) return;

    try {
      setSubmitting(true);
      const res = await fuelAPI.update(currentOrganization.id, id, payload);
      setLog(res.data);
      toast.success(t('fuel.toastUpdated'));
    } catch (err) {
      console.error('Failed to update fuel log:', err);
      toast.error(t('fuel.toastError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!currentOrganization?.id || !id) return;

    try {
      setDeleting(true);
      await fuelAPI.delete(currentOrganization.id, id);
      setShowDeleteDialog(false);
      toast.success(t('fuel.toastDeleted'));
      router.push('/dashboard/fuel');
    } catch (err) {
      console.error('Failed to delete fuel log:', err);
      toast.error(t('fuel.toastError'));
    } finally {
      setDeleting(false);
    }
  };

  if (!currentOrganization?.id) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('fuel.editLog')}</h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t('common.selectOrganization')}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('fuel.editLog')}</h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('fuel.editLog')}</h1>
        </div>
        <div className="text-center text-muted-foreground">
          {t('fuel.logNotFound')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('fuel.backToList')}
        </Button>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          {t('fuel.deleteLog')}
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('fuel.editLog')}</h1>
      </div>

      <div className="max-w-2xl">
        <FuelForm
          initialValues={log}
          onSubmit={handleSubmit}
          loading={submitting}
        />
      </div>

      <DeleteFuelDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

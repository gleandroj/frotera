"use client";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/i18n/useTranslation";
import { driversAPI, type Driver } from "@/lib/frontend/api-client";
import { toast } from "sonner";
import { useState } from "react";

interface DeleteDriverDialogProps {
  driver: Driver | null;
  organizationId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteDriverDialog({
  driver, organizationId, onOpenChange, onSuccess,
}: DeleteDriverDialogProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!driver) return;
    setLoading(true);
    try {
      await driversAPI.delete(organizationId, driver.id);
      toast.success(t("drivers.toastDeleted"));
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("drivers.toastError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={!!driver} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("drivers.confirmDelete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("drivers.confirmDelete.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading}>
            {loading ? t("common.loading") : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

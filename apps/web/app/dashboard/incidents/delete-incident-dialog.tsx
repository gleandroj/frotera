"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
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
import { incidentsAPI, type Incident } from "@/lib/frontend/api-client";
import { toast } from "sonner";

interface DeleteIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: Incident | null;
  organizationId: string;
  onSuccess: () => void;
}

export function DeleteIncidentDialog({
  open,
  onOpenChange,
  incident,
  organizationId,
  onSuccess,
}: DeleteIncidentDialogProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = () => {
    if (!incident?.id || !organizationId) return;
    setDeleting(true);
    incidentsAPI
      .remove(organizationId, incident.id)
      .then(() => {
        toast.success(t("incidents.toast.deleted"));
        onSuccess();
        onOpenChange(false);
      })
      .catch(() => {
        toast.error(t("incidents.toast.error"));
      })
      .finally(() => setDeleting(false));
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("incidents.confirmDelete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("incidents.confirmDelete.description")}
            {incident?.title ? (
              <span className="mt-2 block font-medium">{incident.title}</span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={deleting}>
            {deleting ? t("common.loading") : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

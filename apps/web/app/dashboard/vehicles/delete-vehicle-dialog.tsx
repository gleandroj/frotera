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
import { vehiclesAPI, type Vehicle } from "@/lib/frontend/api-client";

interface DeleteVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  organizationId: string;
  onSuccess: () => void;
}

export function DeleteVehicleDialog({
  open,
  onOpenChange,
  vehicle,
  organizationId,
  onSuccess,
}: DeleteVehicleDialogProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = () => {
    if (!vehicle?.id || !organizationId) return;
    setDeleting(true);
    vehiclesAPI
      .delete(organizationId, vehicle.id)
      .then(() => {
        onSuccess();
        onOpenChange(false);
      })
      .finally(() => setDeleting(false));
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("vehicles.confirmDelete.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("vehicles.confirmDelete.description")}
            {vehicle?.name || vehicle?.plate ? (
              <span className="mt-2 block font-medium">
                {vehicle.name ?? vehicle.plate ?? vehicle.id}
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? t("common.loading") : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

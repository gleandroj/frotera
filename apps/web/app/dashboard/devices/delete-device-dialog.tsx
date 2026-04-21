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
import { trackerDevicesAPI } from "@/lib/frontend/api-client";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error-message";

interface Device {
  id: string;
  imei: string;
  model: string;
  name?: string | null;
}

interface DeleteDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: Device | null;
  organizationId: string;
  onSuccess: () => void;
}

export function DeleteDeviceDialog({
  open,
  onOpenChange,
  device,
  organizationId,
  onSuccess,
}: DeleteDeviceDialogProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = () => {
    if (!device?.id || !organizationId) return;
    setDeleting(true);
    (trackerDevicesAPI.delete(organizationId, device.id) as any)
      .then(() => {
        toast.success(t("devices.toastDeleted"));
        onSuccess();
        onOpenChange(false);
      })
      .catch((error) => {
        toast.error(getApiErrorMessage(error, t, "common.error"));
      })
      .finally(() => setDeleting(false));
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("devices.confirmDelete.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("devices.confirmDelete.description")}
            {device?.name || device?.imei ? (
              <span className="mt-2 block font-medium">
                {device.name ?? device.imei ?? device.id}
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

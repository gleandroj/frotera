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
import { customersAPI, type Customer } from "@/lib/frontend/api-client";

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  organizationId: string;
  onSuccess: () => void;
}

export function DeleteCustomerDialog({
  open,
  onOpenChange,
  customer,
  organizationId,
  onSuccess,
}: DeleteCustomerDialogProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = () => {
    if (!customer?.id || !organizationId) return;
    setDeleting(true);
    customersAPI
      .delete(organizationId, customer.id)
      .then(() => {
        onSuccess();
        onOpenChange(false);
      })
      .catch(() => setDeleting(false))
      .finally(() => setDeleting(false));
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("customers.confirmDeactivate.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("customers.confirmDeactivate.description")}
            {customer?.name ? (
              <span className="mt-2 block font-medium">{customer.name}</span>
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
            {deleting ? t("common.loading") : t("common.deactivate")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

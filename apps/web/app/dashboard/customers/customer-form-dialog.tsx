"use client";

import { useEffect } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { customersAPI, type Customer } from "@/lib/frontend/api-client";
import { useFormik } from "formik";
import { toast } from "sonner";

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  organizationId: string;
  customers: Customer[];
  onSuccess: () => void;
  /** When creating, pre-select this parent when provided and present in the list. */
  defaultParentId?: string | null;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  organizationId,
  customers,
  onSuccess,
  defaultParentId,
}: CustomerFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!customer;

  const parentOptions = customers.filter(
    (c) => !isEdit || c.id !== customer?.id
  );

  const getInitialParentId = () => {
    if (isEdit) return customer?.parentId ?? "";
    if (defaultParentId && parentOptions.some((c) => c.id === defaultParentId)) {
      return defaultParentId;
    }
    if (parentOptions.length === 1) return parentOptions[0].id;
    return "";
  };

  const formik = useFormik({
    initialValues: {
      name: customer?.name ?? "",
      parentId: getInitialParentId(),
    },
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (!isEdit && !values.parentId?.trim()) {
        formik.setFieldError("parentId", t("customers.parentRequired"));
        return;
      }
      try {
        if (isEdit) {
          await customersAPI.update(organizationId, customer.id, {
            name: values.name,
            parentId: values.parentId || null,
          });
          toast.success(t("customers.updated"));
        } else {
          await customersAPI.create(organizationId, {
            name: values.name,
            parentId: values.parentId || undefined,
          });
          toast.success(t("customers.created"));
        }
        onSuccess();
        onOpenChange(false);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? t("common.error");
        toast.error(msg);
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    formik.resetForm();
    formik.setValues({
      name: customer?.name ?? "",
      parentId: getInitialParentId(),
    });
  }, [open, customer?.id, defaultParentId]);

  const parentRequired = !isEdit;
  const parentSelectValue =
    formik.values.parentId || (parentRequired ? "" : "none");
  const parentSelectPlaceholder = parentRequired
    ? t("customers.selectParent")
    : t("customers.noParent");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("customers.editCustomer") : t("customers.createCustomer")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("common.name")}</Label>
            <Input
              id="name"
              name="name"
              value={formik.values.name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder={t("customers.namePlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parentId">{t("customers.parent")}</Label>
            <Select
              value={
                formik.values.parentId ||
                (parentRequired ? "" : "none")
              }
              onValueChange={(v) =>
                formik.setFieldValue("parentId", v === "none" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={parentSelectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {!parentRequired && (
                  <SelectItem value="none">{t("customers.noParent")}</SelectItem>
                )}
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span
                      style={{
                        paddingLeft: (c.depth ?? 0) * 12,
                      }}
                      className="inline-block"
                    >
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {parentRequired && formik.errors.parentId && (
              <p className="text-sm text-destructive">
                {formik.errors.parentId}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={formik.isSubmitting}>
              {formik.isSubmitting
                ? t("common.loading")
                : isEdit
                  ? t("common.save")
                  : t("customers.createCustomer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

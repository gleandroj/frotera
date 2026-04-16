"use client";

import { useEffect, useState } from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { customersAPI, type Customer } from "@/lib/frontend/api-client";
import { useFormik } from "formik";
import { toast } from "sonner";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
    return "";
  };

  const [parentComboboxOpen, setParentComboboxOpen] = useState(false);

  const formik = useFormik({
    initialValues: {
      name: customer?.name ?? "",
      parentId: getInitialParentId(),
    },
    enableReinitialize: true,
    onSubmit: async (values) => {
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

  const selectedParent = parentOptions.find(
    (c) => c.id === formik.values.parentId
  );

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
            <Popover
              open={parentComboboxOpen}
              onOpenChange={setParentComboboxOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  id="parentId"
                  variant="outline"
                  role="combobox"
                  aria-expanded={parentComboboxOpen}
                  className={cn(
                    "w-full justify-between font-normal h-10",
                    !formik.values.parentId && "text-muted-foreground"
                  )}
                >
                  <span className="truncate">
                    {formik.values.parentId && selectedParent ? (
                      <span
                        style={{
                          paddingLeft: (selectedParent.depth ?? 0) * 12,
                        }}
                        className="inline-block"
                      >
                        {selectedParent.name}
                      </span>
                    ) : (
                      t("customers.noParent")
                    )}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command
                  filter={(value, search) =>
                    !search
                      ? 1
                      : (value ?? "")
                          .toLowerCase()
                          .includes(search.toLowerCase())
                        ? 1
                        : 0
                  }
                >
                  <CommandInput
                    placeholder={t("customers.filterParent")}
                    className="h-9"
                  />
                  <CommandList>
                    <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value={t("customers.noParent")}
                        onSelect={() => {
                          formik.setFieldValue("parentId", "");
                          setParentComboboxOpen(false);
                        }}
                      >
                        {t("customers.noParent")}
                      </CommandItem>
                      {parentOptions.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            formik.setFieldValue("parentId", c.id);
                            setParentComboboxOpen(false);
                          }}
                        >
                          <span
                            style={{
                              paddingLeft: (c.depth ?? 0) * 12,
                            }}
                            className="inline-block"
                          >
                            {c.name}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

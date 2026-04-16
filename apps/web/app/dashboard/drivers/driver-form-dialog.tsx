"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { z } from "zod";
import { toFormikValidationSchema } from "zod-formik-adapter";
import { toast } from "sonner";
import {
  driversAPI, customersAPI,
  type Driver, type Customer,
  type CreateDriverPayload, type UpdateDriverPayload,
} from "@/lib/frontend/api-client";

const CNH_CATEGORIES = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"] as const;

interface DriverFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver | null;
  organizationId: string;
  onSuccess: () => void;
  defaultCustomerId?: string | null;
}

interface DriverFormValues {
  name: string;
  customerId: string;
  cpf: string;
  cnh: string;
  cnhCategory: string;
  cnhExpiry: string;   // YYYY-MM-DD
  phone: string;
  email: string;
  photo: string;
  notes: string;
  active: boolean;
}

function getInitialValues(driver: Driver | null, defaultCustomerId?: string | null): DriverFormValues {
  return {
    name: driver?.name ?? "",
    customerId: driver?.customerId ?? defaultCustomerId ?? "",
    cpf: driver?.cpf ?? "",
    cnh: driver?.cnh ?? "",
    cnhCategory: driver?.cnhCategory ?? "",
    cnhExpiry: driver?.cnhExpiry ? driver.cnhExpiry.substring(0, 10) : "",
    phone: driver?.phone ?? "",
    email: driver?.email ?? "",
    photo: driver?.photo ?? "",
    notes: driver?.notes ?? "",
    active: driver?.active ?? true,
  };
}

function buildSchema(t: (k: string) => string) {
  return z.object({
    name: z.string().min(1, t("drivers.nameRequired")),
    customerId: z.string().optional(),
    cpf: z.string().optional(),
    cnh: z.string().optional(),
    cnhCategory: z.string().optional(),
    cnhExpiry: z.string().optional(),
    phone: z.string().optional(),
    email: z.union([z.string().email(t("drivers.emailInvalid")), z.literal("")]).optional(),
    photo: z.string().optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  });
}

export function DriverFormDialog({
  open, onOpenChange, driver, organizationId, onSuccess, defaultCustomerId,
}: DriverFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!driver;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoadingCustomers(true);
    customersAPI
      .list(organizationId)
      .then((res) => setCustomers(res.data?.customers ?? []))
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [open, organizationId]);

  const handleSubmit = (values: DriverFormValues, { setStatus }: any) => {
    setStatus(undefined);

    const payload = {
      name: values.name.trim(),
      customerId: values.customerId || undefined,
      cpf: values.cpf.trim() || undefined,
      cnh: values.cnh.trim() || undefined,
      cnhCategory: values.cnhCategory || undefined,
      cnhExpiry: values.cnhExpiry || undefined,
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      photo: values.photo.trim() || undefined,
      notes: values.notes.trim() || undefined,
    };

    const promise = isEdit
      ? driversAPI.update(organizationId, driver!.id, payload as UpdateDriverPayload)
      : driversAPI.create(organizationId, payload as CreateDriverPayload);

    return promise
      .then(() => {
        toast.success(isEdit ? t("drivers.toastUpdated") : t("drivers.toastCreated"));
        onSuccess();
        onOpenChange(false);
      })
      .catch((err: any) => {
        const message = err?.response?.data?.message ?? t("drivers.toastError");
        setStatus(message);
        toast.error(message);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("drivers.editDriver") : t("drivers.createDriver")}
          </DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={getInitialValues(driver, defaultCustomerId)}
          validationSchema={toFormikValidationSchema(buildSchema(t))}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ values, setFieldValue, isSubmitting, errors, touched, status }) => (
            <Form className="space-y-6" noValidate>
              {status && (
                <p className="text-destructive text-sm" role="alert">{status}</p>
              )}

              {/* Seção: Dados Pessoais */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b pb-1">
                  {t("drivers.sectionPersonal")}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="driver-name">{t("common.name")} *</Label>
                    <Field
                      as={Input}
                      id="driver-name"
                      name="name"
                      placeholder={t("drivers.namePlaceholder")}
                      className={errors.name && touched.name ? "border-destructive" : ""}
                    />
                    <ErrorMessage name="name" component="div" className="text-destructive text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver-cpf">{t("drivers.cpf")}</Label>
                    <Field
                      as={Input}
                      id="driver-cpf"
                      name="cpf"
                      placeholder="000.000.000-00"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver-phone">{t("common.phone")}</Label>
                    <Field as={Input} id="driver-phone" name="phone" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="driver-email">{t("common.email")}</Label>
                    <Field
                      as={Input}
                      id="driver-email"
                      name="email"
                      type="email"
                      className={errors.email && touched.email ? "border-destructive" : ""}
                    />
                    <ErrorMessage name="email" component="div" className="text-destructive text-sm" />
                  </div>
                </div>

                {/* Empresa vinculada */}
                <div className="space-y-2">
                  <Label>{t("drivers.customer")}</Label>
                  <Popover open={customerComboboxOpen} onOpenChange={setCustomerComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        disabled={loadingCustomers}
                        className={cn(
                          "w-full justify-between font-normal h-10",
                          !values.customerId && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">
                          {values.customerId
                            ? customers.find((c) => c.id === values.customerId)?.name
                              ?? t("drivers.selectCustomer")
                            : t("drivers.selectCustomer")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t("drivers.filterCustomer")} className="h-9" />
                        <CommandList>
                          <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value=""
                              onSelect={() => {
                                setFieldValue("customerId", "");
                                setCustomerComboboxOpen(false);
                              }}
                            >
                              {t("drivers.noCustomer")}
                            </CommandItem>
                            {customers.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={() => {
                                  setFieldValue("customerId", c.id);
                                  setCustomerComboboxOpen(false);
                                }}
                              >
                                <span
                                  style={{ paddingLeft: (c.depth ?? 0) * 12 }}
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
              </div>

              {/* Seção: CNH */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b pb-1">{t("drivers.sectionCnh")}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="driver-cnh">{t("drivers.cnh")}</Label>
                    <Field as={Input} id="driver-cnh" name="cnh" className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver-cnhCategory">{t("drivers.cnhCategory")}</Label>
                    <Select
                      value={values.cnhCategory || "__none__"}
                      onValueChange={(v) => setFieldValue("cnhCategory", v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger id="driver-cnhCategory">
                        <SelectValue placeholder={t("drivers.selectCnhCategory")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("drivers.noCnhCategory")}</SelectItem>
                        {CNH_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver-cnhExpiry">{t("drivers.cnhExpiry")}</Label>
                    <Field
                      as={Input}
                      id="driver-cnhExpiry"
                      name="cnhExpiry"
                      type="date"
                    />
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label htmlFor="driver-notes">{t("drivers.notes")}</Label>
                <Field
                  as={Textarea}
                  id="driver-notes"
                  name="notes"
                  placeholder={t("drivers.notesPlaceholder")}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? isEdit ? t("common.updating") : t("common.creating")
                    : isEdit ? t("common.update") : t("common.create")}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}

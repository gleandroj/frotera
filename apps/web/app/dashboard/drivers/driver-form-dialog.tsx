"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "@/i18n/useTranslation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Separator } from "@/components/ui/separator";
import {
  driversAPI,
  customersAPI,
  type Driver,
  type Customer,
  type CreateDriverPayload,
  type UpdateDriverPayload,
} from "@/lib/frontend/api-client";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CNH_CATEGORIES = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"] as const;

interface DriverFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver | null;
  organizationId: string;
  onSuccess: () => void;
  defaultCustomerId?: string | null;
}

const buildSchema = (t: (k: string) => string) =>
  z.object({
    name: z.string().min(1, t("drivers.nameRequired")),
    customerId: z.string().default(""),
    cpf: z.string().default(""),
    cnh: z.string().default(""),
    cnhCategory: z.string().default(""),
    cnhExpiry: z.string().default(""),
    phone: z.string().default(""),
    email: z
      .union([z.string().email(t("drivers.emailInvalid")), z.literal("")])
      .default(""),
    photo: z.string().default(""),
    notes: z.string().default(""),
    active: z.boolean().default(true),
  });

type DriverFormValues = z.infer<ReturnType<typeof buildSchema>>;

function getDefaultValues(
  driver: Driver | null,
  defaultCustomerId?: string | null
): DriverFormValues {
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

export function DriverFormDialog({
  open,
  onOpenChange,
  driver,
  organizationId,
  onSuccess,
  defaultCustomerId,
}: DriverFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!driver;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);

  const form = useForm<DriverFormValues>({
    resolver: zodResolver(buildSchema(t)),
    defaultValues: getDefaultValues(driver, defaultCustomerId),
  });

  const { isSubmitting } = form.formState;
  const customerId = form.watch("customerId");

  useEffect(() => {
    if (!open) return;
    form.reset(getDefaultValues(driver, defaultCustomerId));
  }, [open, driver?.id]);

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoadingCustomers(true);
    customersAPI
      .list(organizationId)
      .then((res) => setCustomers(res.data?.customers ?? []))
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [open, organizationId]);

  const handleSubmit = async (values: DriverFormValues) => {
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

    try {
      if (isEdit) {
        await driversAPI.update(organizationId, driver!.id, payload as UpdateDriverPayload);
      } else {
        await driversAPI.create(organizationId, payload as CreateDriverPayload);
      }
      toast.success(isEdit ? t("drivers.toastUpdated") : t("drivers.toastCreated"));
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("drivers.toastError");
      toast.error(message);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[560px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>
            {isEdit ? t("drivers.editDriver") : t("drivers.createDriver")}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Dados Pessoais */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  {t("drivers.sectionPersonal")}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>{t("common.name")} *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("drivers.namePlaceholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("drivers.cpf")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000.000.000-00"
                            className="font-mono"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.phone")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>{t("common.email")}</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Customer combobox */}
                <FormField
                  control={form.control}
                  name="customerId"
                  render={() => (
                    <FormItem>
                      <FormLabel>{t("drivers.customer")}</FormLabel>
                      <Popover
                        open={customerComboboxOpen}
                        onOpenChange={setCustomerComboboxOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              disabled={loadingCustomers}
                              className={cn(
                                "w-full justify-between font-normal h-10",
                                !customerId && "text-muted-foreground"
                              )}
                            >
                              <span className="truncate">
                                {customerId && selectedCustomer
                                  ? selectedCustomer.name
                                  : t("drivers.selectCustomer")}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                          align="start"
                        >
                          <Command>
                            <CommandInput
                              placeholder={t("drivers.filterCustomer")}
                              className="h-9"
                            />
                            <CommandList>
                              <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value=""
                                  onSelect={() => {
                                    form.setValue("customerId", "", {
                                      shouldValidate: true,
                                    });
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
                                      form.setValue("customerId", c.id, {
                                        shouldValidate: true,
                                      });
                                      setCustomerComboboxOpen(false);
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* CNH */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  {t("drivers.sectionCnh")}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="cnh"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("drivers.cnh")}</FormLabel>
                        <FormControl>
                          <Input className="font-mono" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cnhCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("drivers.cnhCategory")}</FormLabel>
                        <Select
                          value={field.value || "__none__"}
                          onValueChange={(v) =>
                            field.onChange(v === "__none__" ? "" : v)
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t("drivers.selectCnhCategory")}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">
                              {t("drivers.noCnhCategory")}
                            </SelectItem>
                            {CNH_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cnhExpiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("drivers.cnhExpiry")}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Observações */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("drivers.notes")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("drivers.notesPlaceholder")}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-2 bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? isEdit
                    ? t("common.updating")
                    : t("common.creating")
                  : isEdit
                    ? t("common.update")
                    : t("common.create")}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

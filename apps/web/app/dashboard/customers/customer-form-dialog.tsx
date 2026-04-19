"use client";

import { useEffect, useMemo, useState } from "react";
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
import { customersAPI, type Customer } from "@/lib/frontend/api-client";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { onRhfInvalidSubmit } from "@/lib/on-rhf-invalid-submit";

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  organizationId: string;
  customers: Customer[];
  onSuccess: (created?: Customer) => void;
  defaultParentId?: string | null;
  /** When false, parentId is required (non-superadmins cannot create root customers). */
  allowRootCreation?: boolean;
  /** Avoid stacking a second dimming overlay when this sheet opens over another modal/sheet. */
  hideOverlay?: boolean;
}

const buildSchema = (t: (k: string) => string, requireParent: boolean) =>
  z.object({
    name: z.string().min(1, t("common.required")),
    parentId: requireParent
      ? z.string().min(1, t("customers.parentRequired"))
      : z.string().default(""),
  });

type CustomerFormValues = z.infer<ReturnType<typeof buildSchema>>;

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  organizationId,
  customers,
  onSuccess,
  defaultParentId,
  allowRootCreation = true,
  hideOverlay = false,
}: CustomerFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!customer;
  const requireParent = !isEdit && !allowRootCreation;

  const [parentComboboxOpen, setParentComboboxOpen] = useState(false);

  const parentOptions = customers.filter((c) => {
    if (isEdit && c.id === customer?.id) return false;
    if (!c.inactive) return true;
    if (isEdit && c.id === customer?.parentId) return true;
    return false;
  });

  const customersSyncKey = useMemo(
    () => parentOptions.map((c) => c.id).join("|"),
    [customers, isEdit, customer?.id]
  );

  const getDefaultParentId = () => {
    if (isEdit) return customer?.parentId ?? "";
    if (defaultParentId && parentOptions.some((c) => c.id === defaultParentId)) {
      return defaultParentId;
    }
    if (requireParent && parentOptions.length === 1) {
      return parentOptions[0].id;
    }
    return "";
  };

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(buildSchema(t, requireParent)),
    defaultValues: {
      name: customer?.name ?? "",
      parentId: getDefaultParentId(),
    },
  });

  const { isSubmitting } = form.formState;
  const parentId = form.watch("parentId");
  const selectedParent = parentOptions.find((c) => c.id === parentId);

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: customer?.name ?? "",
      parentId: getDefaultParentId(),
    });
  }, [
    open,
    customer?.id,
    customer?.parentId,
    customer?.name,
    defaultParentId,
    allowRootCreation,
    customersSyncKey,
    isEdit,
  ]);

  const handleSubmit = async (values: CustomerFormValues) => {
    try {
      if (isEdit) {
        await customersAPI.update(organizationId, customer.id, {
          name: values.name,
          parentId: values.parentId || null,
        });
        toast.success(t("customers.updated"));
        onSuccess();
      } else {
        const { data: created } = await customersAPI.create(organizationId, {
          name: values.name,
          parentId: values.parentId || undefined,
        });
        toast.success(t("customers.created"));
        onSuccess(created);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("common.error");
      toast.error(msg);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        hideOverlay={hideOverlay}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[440px]"
      >
        <SheetHeader className="border-b px-6 pb-4 pt-6">
          <SheetTitle>
            {isEdit ? t("customers.editCustomer") : t("customers.createCustomer")}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit, onRhfInvalidSubmit(form, t))}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.name")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("customers.namePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentId"
                render={() => (
                  <FormItem>
                    <FormLabel>{t("customers.parent")}</FormLabel>
                    <Popover
                      open={parentComboboxOpen}
                      onOpenChange={setParentComboboxOpen}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "h-10 w-full justify-between font-normal",
                              !parentId && "text-muted-foreground"
                            )}
                          >
                            <span className="truncate">
                              {parentId && selectedParent ? (
                                <span
                                  style={{
                                    paddingLeft: (selectedParent.depth ?? 0) * 12,
                                  }}
                                  className="inline-block"
                                >
                                  {selectedParent.name}
                                </span>
                              ) : requireParent ? (
                                t("customers.selectParent")
                              ) : (
                                t("customers.noParent")
                              )}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        align="start"
                      >
                        <Command
                          filter={(value, search) =>
                            !search
                              ? 1
                              : value.toLowerCase().includes(search.toLowerCase())
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
                              {!requireParent && (
                                <CommandItem
                                  value={t("customers.noParent")}
                                  onSelect={() => {
                                    form.setValue("parentId", "", {
                                      shouldValidate: true,
                                    });
                                    setParentComboboxOpen(false);
                                  }}
                                >
                                  {t("customers.noParent")}
                                </CommandItem>
                              )}
                              {parentOptions.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={c.name}
                                  onSelect={() => {
                                    form.setValue("parentId", c.id, {
                                      shouldValidate: true,
                                    });
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 border-t bg-background px-6 py-4">
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
                  ? t("common.loading")
                  : isEdit
                    ? t("common.save")
                    : t("customers.createCustomer")}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

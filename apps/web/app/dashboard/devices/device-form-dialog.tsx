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
import { trackerDevicesAPI } from "@/lib/frontend/api-client";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error-message";

interface Device {
  id: string;
  imei: string;
  model: string;
  name?: string | null;
  serialSat?: string | null;
  equipmentModel?: string | null;
  individualPassword?: string | null;
  carrier?: string | null;
  simCardNumber?: string | null;
  cellNumber?: string | null;
}

interface DeviceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: Device | null;
  organizationId: string;
  onSuccess: () => void;
}

const baseSchema = z.object({
  name: z.string().default(""),
  serialSat: z.string().default(""),
  equipmentModel: z.string().default(""),
  individualPassword: z.string().default(""),
  carrier: z.string().default(""),
  simCardNumber: z.string().default(""),
  cellNumber: z.string().default(""),
});

const createSchema = baseSchema.extend({
  imei: z.string().min(1, "IMEI é obrigatório"),
  model: z.string().min(1, "Modelo é obrigatório"),
});

type DeviceFormValues = z.infer<typeof baseSchema>;
type CreateFormValues = z.infer<typeof createSchema>;

function defaultValues(device: Device | null): any {
  return {
    name: device?.name ?? "",
    serialSat: device?.serialSat ?? "",
    equipmentModel: device?.equipmentModel ?? "",
    individualPassword: device?.individualPassword ?? "",
    carrier: device?.carrier ?? "",
    simCardNumber: device?.simCardNumber ?? "",
    cellNumber: device?.cellNumber ?? "",
    ...(device
      ? {}
      : {
          imei: "",
          model: "X12_GT06",
        }),
  };
}

export function DeviceFormDialog({
  open,
  onOpenChange,
  device,
  organizationId,
  onSuccess,
}: DeviceFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!device;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<any>({
    resolver: zodResolver(isEdit ? baseSchema : createSchema),
    defaultValues: defaultValues(device),
    mode: "onTouched",
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues(device));
    }
  }, [open, device, form]);

  const onSubmit = (data: any) => {
    setIsSubmitting(true);

    const promise = isEdit
      ? trackerDevicesAPI.update(organizationId, device!.id, {
          name: data.name || undefined,
          serialSat: data.serialSat || undefined,
          equipmentModel: data.equipmentModel || undefined,
          individualPassword: data.individualPassword || undefined,
          carrier: data.carrier || undefined,
          simCardNumber: data.simCardNumber || undefined,
          cellNumber: data.cellNumber || undefined,
        } as any)
      : trackerDevicesAPI.create(organizationId, {
          imei: data.imei,
          model: data.model,
          name: data.name || undefined,
          serialSat: data.serialSat || undefined,
          equipmentModel: data.equipmentModel || undefined,
          individualPassword: data.individualPassword || undefined,
          carrier: data.carrier || undefined,
          simCardNumber: data.simCardNumber || undefined,
          cellNumber: data.cellNumber || undefined,
        } as any);

    promise
      .then(() => {
        toast.success(
          isEdit ? t("devices.toastUpdated") : t("devices.toastCreated")
        );
        onSuccess();
        onOpenChange(false);
      })
      .catch((error) => {
        toast.error(getApiErrorMessage(error, t, "common.error"));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t("devices.editDevice") : t("devices.createDevice")}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            {!isEdit && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="imei"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("devices.imei")} *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("devices.imeiPlaceholder") || "000000000000000"}
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
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("devices.model")} *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="X12_GT06">X12 GT06</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <p className="text-sm font-medium">{t("devices.sectionDetails")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t("devices.name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("common.name")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="equipmentModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("devices.equipmentModel")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: SUNT CH" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serialSat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("devices.serialSat")}</FormLabel>
                      <FormControl>
                        <Input className="font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="individualPassword"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t("devices.individualPassword")}</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <p className="text-sm font-medium pt-2">
                {t("devices.sectionSimData")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="carrier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("devices.carrier")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: SMARTSIM" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="simCardNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("devices.simCardNumber")}</FormLabel>
                      <FormControl>
                        <Input className="font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cellNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("devices.cellNumber")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 16995636896" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-6 border-t">
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
                    ? t("common.save")
                    : t("common.create")}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

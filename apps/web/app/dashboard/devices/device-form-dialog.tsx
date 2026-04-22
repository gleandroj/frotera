"use client";

import { useEffect, useState, useCallback } from "react";
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
import {
  trackerDevicesAPI,
  type CreateVehicleNewDevicePayload,
} from "@/lib/frontend/api-client";
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
  odometerSource?: string | null;
}

interface DeviceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hideOverlay?: boolean;
  // API mode (devices page — standalone create / edit)
  device?: Device | null;
  organizationId?: string;
  onSuccess?: () => void;
  // Sub-form mode (vehicle form — no API call, just collects data)
  onConfirm?: (data: CreateVehicleNewDevicePayload) => void;
  initialData?: Partial<CreateVehicleNewDevicePayload>;
}

const editSchema = z.object({
  imei: z.string().default(""),
  model: z.string().default(""),
  name: z.string().default(""),
  serialSat: z.string().default(""),
  equipmentModel: z.string().default(""),
  individualPassword: z.string().default(""),
  carrier: z.string().default(""),
  simCardNumber: z.string().default(""),
  cellNumber: z.string().default(""),
  odometerSource: z.enum(["CALCULATED", "DEVICE"]).default("CALCULATED"),
});

const createSchema = editSchema.extend({
  imei: z.string().min(1, "IMEI é obrigatório"),
  model: z.string().min(1, "Protocolo é obrigatório"),
});

type FormValues = z.infer<typeof createSchema>;

function toFormValues(
  device: Device | null,
  initialData?: Partial<CreateVehicleNewDevicePayload>,
): FormValues {
  if (device) {
    return {
      imei: device.imei,
      model: device.model,
      name: device.name ?? "",
      serialSat: device.serialSat ?? "",
      equipmentModel: device.equipmentModel ?? "",
      individualPassword: device.individualPassword ?? "",
      carrier: device.carrier ?? "",
      simCardNumber: device.simCardNumber ?? "",
      cellNumber: device.cellNumber ?? "",
      odometerSource: device.odometerSource === "DEVICE" ? "DEVICE" : "CALCULATED",
    };
  }
  return {
    imei: initialData?.imei ?? "",
    model: initialData?.model ?? "X12_GT06",
    name: initialData?.name ?? "",
    serialSat: initialData?.serialSat ?? "",
    equipmentModel: initialData?.equipmentModel ?? "",
    individualPassword: initialData?.individualPassword ?? "",
    carrier: initialData?.carrier ?? "",
    simCardNumber: initialData?.simCardNumber ?? "",
    cellNumber: initialData?.cellNumber ?? "",
    odometerSource: "CALCULATED",
  };
}

export function DeviceFormDialog({
  open,
  onOpenChange,
  hideOverlay,
  device = null,
  organizationId,
  onSuccess,
  onConfirm,
  initialData,
}: DeviceFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!device;
  const isSubform = !!onConfirm;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingOdometer, setIsResettingOdometer] = useState(false);

  const handleResetOdometer = useCallback(() => {
    if (!organizationId || !device?.id) return;
    if (!window.confirm(t("devices.resetOdometerConfirm"))) return;
    setIsResettingOdometer(true);
    trackerDevicesAPI.resetOdometer(organizationId, device.id)
      .then(() => toast.success(t("devices.toastOdometerReset")))
      .catch((error) => toast.error(getApiErrorMessage(error, t, "common.error")))
      .finally(() => setIsResettingOdometer(false));
  }, [organizationId, device?.id, t]);

  const form = useForm<FormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: toFormValues(device, initialData),
    mode: "onTouched",
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(device, initialData));
    }
  }, [open, device]);

  const onSubmit = (data: FormValues) => {
    if (isSubform && onConfirm) {
      onConfirm({
        imei: data.imei,
        model: data.model,
        name: data.name || undefined,
        serialSat: data.serialSat || undefined,
        equipmentModel: data.equipmentModel || undefined,
        individualPassword: data.individualPassword || undefined,
        carrier: data.carrier || undefined,
        simCardNumber: data.simCardNumber || undefined,
        cellNumber: data.cellNumber || undefined,
      });
      onOpenChange(false);
      return;
    }

    if (!organizationId || !onSuccess) return;

    setIsSubmitting(true);

    const commonFields = {
      name: data.name || undefined,
      serialSat: data.serialSat || undefined,
      equipmentModel: data.equipmentModel || undefined,
      individualPassword: data.individualPassword || undefined,
      carrier: data.carrier || undefined,
      simCardNumber: data.simCardNumber || undefined,
      cellNumber: data.cellNumber || undefined,
      odometerSource: data.odometerSource,
    };

    const promise = isEdit
      ? trackerDevicesAPI.update(organizationId, device!.id, commonFields)
      : trackerDevicesAPI.create(organizationId, {
          ...commonFields,
          imei: data.imei,
          model: data.model,
        });

    promise
      .then(() => {
        toast.success(
          isEdit ? t("devices.toastUpdated") : t("devices.toastCreated"),
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
      <SheetContent
        hideOverlay={hideOverlay}
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t("devices.editDevice") : t("devices.createDevice")}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 mt-6"
            autoComplete="off"
          >
            {/* Identification */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <p className="text-sm font-medium">
                {t("devices.sectionIdentification")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="imei"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("devices.imei")}
                        {!isEdit && " *"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            t("devices.imeiPlaceholder") || "000000000000000"
                          }
                          className="font-mono"
                          autoComplete="off"
                          disabled={isEdit}
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
                      <FormLabel>
                        {t("devices.model")}
                        {!isEdit && " *"}
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isEdit}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="X12_GT06">GT06</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Details */}
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
                        <Input
                          placeholder={t("common.name")}
                          autoComplete="off"
                          {...field}
                        />
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
                        <Input
                          placeholder="Ex: SUNT CH"
                          autoComplete="off"
                          {...field}
                        />
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
                        <Input
                          className="font-mono"
                          autoComplete="off"
                          {...field}
                        />
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
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* SIM */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <p className="text-sm font-medium">{t("devices.sectionSimData")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="carrier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("devices.carrier")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: SMARTSIM"
                          autoComplete="off"
                          {...field}
                        />
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
                        <Input
                          className="font-mono"
                          autoComplete="off"
                          {...field}
                        />
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
                        <Input
                          placeholder="Ex: 16995636896"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Odometer — API mode only */}
            {!isSubform && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <p className="text-sm font-medium">
                  {t("devices.sectionOdometer")}
                </p>
                <FormField
                  control={form.control}
                  name="odometerSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("devices.odometerSource")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CALCULATED">
                            {t("devices.odometerSourceCalculated")}
                          </SelectItem>
                          <SelectItem value="DEVICE">
                            {t("devices.odometerSourceDevice")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isEdit && (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isResettingOdometer}
                      onClick={handleResetOdometer}
                    >
                      {t("devices.resetOdometer")}
                    </Button>
                  </div>
                )}
              </div>
            )}

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
                  : isSubform
                    ? t("common.confirm")
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

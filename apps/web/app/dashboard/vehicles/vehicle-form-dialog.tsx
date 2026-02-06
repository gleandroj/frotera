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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  vehiclesAPI,
  trackerDevicesAPI,
  type Vehicle,
  type CreateVehiclePayload,
  type UpdateVehiclePayload,
} from "@/lib/frontend/api-client";
import { ErrorMessage, Field, Form, Formik, type FormikHelpers } from "formik";
import { z } from "zod";
import { toFormikValidationSchema } from "zod-formik-adapter";
import { toast } from "sonner";

const TRACKER_MODELS = [
  { value: "X12_GT06", label: "X12 GT06" },
  { value: "X22_NT20", label: "X22 NT20" },
] as const;

type DeviceOption = "none" | "existing" | "new";

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  organizationId: string;
  onSuccess: () => void;
}

interface TrackerDeviceOption {
  id: string;
  imei: string;
  model: string;
  name?: string | null;
  vehicleId?: string | null;
}

function emptyStr(s: string | null | undefined): string {
  return s ?? "";
}

export interface VehicleFormValues {
  name: string;
  plate: string;
  serial: string;
  color: string;
  year: string;
  renavam: string;
  chassis: string;
  vehicleType: string;
  inactive: boolean;
  notes: string;
  trackerDeviceId: string;
  deviceOption: DeviceOption;
  newImei: string;
  newModel: string;
  newDeviceName: string;
  newSerialSat: string;
  newEquipmentModel: string;
  newIndividualPassword: string;
  newCarrier: string;
  newSimCardNumber: string;
  newCellNumber: string;
}

function getInitialValues(vehicle: Vehicle | null, isEdit: boolean): VehicleFormValues {
  const base = {
    name: emptyStr(vehicle?.name),
    plate: emptyStr(vehicle?.plate),
    serial: emptyStr(vehicle?.serial),
    color: emptyStr(vehicle?.color),
    year: emptyStr(vehicle?.year),
    renavam: emptyStr(vehicle?.renavam),
    chassis: emptyStr(vehicle?.chassis),
    vehicleType: emptyStr(vehicle?.vehicleType),
    inactive: vehicle?.inactive ?? false,
    notes: emptyStr(vehicle?.notes),
    trackerDeviceId: emptyStr(vehicle?.trackerDeviceId),
    deviceOption: "none" as DeviceOption,
    newImei: "",
    newModel: "X12_GT06",
    newDeviceName: "",
    newSerialSat: "",
    newEquipmentModel: "",
    newIndividualPassword: "",
    newCarrier: "",
    newSimCardNumber: "",
    newCellNumber: "",
  };
  if (isEdit) return base;
  return base;
}

function buildVehicleFormSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().optional(),
      plate: z
        .string()
        .min(1, t("vehicles.plateRequired"))
        .refine((v) => (v?.trim() ?? "").length > 0, {
          message: t("vehicles.plateRequired"),
        }),
      serial: z.string().optional(),
      color: z.string().optional(),
      year: z.string().optional(),
      renavam: z.string().optional(),
      chassis: z.string().optional(),
      vehicleType: z.string().optional(),
      inactive: z.boolean().optional(),
      notes: z.string().optional(),
      trackerDeviceId: z.string().optional(),
      deviceOption: z.enum(["none", "existing", "new"]).optional(),
      newImei: z.string().optional(),
      newModel: z.string().optional(),
      newDeviceName: z.string().optional(),
      newSerialSat: z.string().optional(),
      newEquipmentModel: z.string().optional(),
      newIndividualPassword: z.string().optional(),
      newCarrier: z.string().optional(),
      newSimCardNumber: z.string().optional(),
      newCellNumber: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.deviceOption === "new") {
          return (data.newImei?.trim() ?? "") !== "";
        }
        return true;
      },
      { message: t("vehicles.imeiRequired"), path: ["newImei"] }
    );
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  vehicle,
  organizationId,
  onSuccess,
}: VehicleFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!vehicle;

  const [devices, setDevices] = useState<TrackerDeviceOption[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const validationSchema = buildVehicleFormSchema(t);
  const initialValues = getInitialValues(vehicle, isEdit);

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoadingDevices(true);
    trackerDevicesAPI
      .list(organizationId)
      .then((res) => {
        setDevices(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setDevices([]))
      .finally(() => setLoadingDevices(false));
  }, [open, organizationId]);

  const handleSubmit = (
    values: VehicleFormValues,
    { setStatus }: FormikHelpers<VehicleFormValues>
  ) => {
    setStatus(undefined);
    const vehiclePayload = {
      name: values.name.trim() || undefined,
      plate: values.plate.trim() || undefined,
      serial: values.serial.trim() || undefined,
      color: values.color.trim() || undefined,
      year: values.year.trim() || undefined,
      renavam: values.renavam.trim() || undefined,
      chassis: values.chassis.trim() || undefined,
      vehicleType: values.vehicleType.trim() || undefined,
      inactive: values.inactive,
      notes: values.notes.trim() || undefined,
    };

    let payload: CreateVehiclePayload | UpdateVehiclePayload;
    if (isEdit) {
      payload = {
        ...vehiclePayload,
        trackerDeviceId: values.trackerDeviceId || undefined,
      };
    } else {
      if (values.deviceOption === "new" && values.newImei.trim()) {
        payload = {
          ...vehiclePayload,
          newDevice: {
            imei: values.newImei.trim(),
            model: values.newModel,
            name: values.newDeviceName.trim() || undefined,
            serialSat: values.newSerialSat.trim() || undefined,
            equipmentModel: values.newEquipmentModel.trim() || undefined,
            individualPassword: values.newIndividualPassword.trim() || undefined,
            carrier: values.newCarrier.trim() || undefined,
            simCardNumber: values.newSimCardNumber.trim() || undefined,
            cellNumber: values.newCellNumber.trim() || undefined,
          },
        };
      } else if (values.deviceOption === "existing" && values.trackerDeviceId) {
        payload = { ...vehiclePayload, trackerDeviceId: values.trackerDeviceId };
      } else {
        payload = vehiclePayload;
      }
    }

    const promise = isEdit
      ? vehiclesAPI.update(organizationId, vehicle!.id, payload as UpdateVehiclePayload)
      : vehiclesAPI.create(organizationId, payload as CreateVehiclePayload);

    return promise
      .then(() => {
        toast.success(
          isEdit ? t("vehicles.toastUpdated") : t("vehicles.toastCreated")
        );
        onSuccess();
        onOpenChange(false);
      })
      .catch((err) => {
        const message = err?.response?.data?.message ?? t("vehicles.toastError");
        setStatus(message);
        toast.error(message);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("vehicles.editVehicle") : t("vehicles.createVehicle")}
          </DialogTitle>
        </DialogHeader>
        <Formik<VehicleFormValues>
          initialValues={initialValues}
          validationSchema={toFormikValidationSchema(validationSchema)}
          onSubmit={handleSubmit}
          enableReinitialize
          validateOnChange
          validateOnBlur
        >
          {({ values, setFieldValue, isSubmitting, errors, touched, status }) => (
            <Form className="space-y-6" noValidate>
              {status && (
                <p className="text-destructive text-sm" role="alert">
                  {status}
                </p>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b pb-1">
                  {t("vehicles.sectionGeneral")}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle-name">{t("common.name")}</Label>
                    <Field
                      as={Input}
                      id="vehicle-name"
                      name="name"
                      placeholder="Ex: FIAT/PALIO FIRE"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle-plate">{t("vehicles.plate")}</Label>
                    <Field
                      as={Input}
                      id="vehicle-plate"
                      name="plate"
                      placeholder={t("vehicles.plate")}
                      className={errors.plate ? "border-destructive" : ""}
                    />
                    <ErrorMessage
                      name="plate"
                      component="div"
                      className="text-destructive text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle-serial">{t("vehicles.serial")}</Label>
                    <Field
                      as={Input}
                      id="vehicle-serial"
                      name="serial"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle-color">{t("vehicles.color")}</Label>
                    <Field as={Input} id="vehicle-color" name="color" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle-year">{t("vehicles.year")}</Label>
                    <Field
                      as={Input}
                      id="vehicle-year"
                      name="year"
                      placeholder="Ex: 2015"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle-vehicleType">
                      {t("vehicles.vehicleType")}
                    </Label>
                    <Field
                      as={Input}
                      id="vehicle-vehicleType"
                      name="vehicleType"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle-renavam">{t("vehicles.renavam")}</Label>
                    <Field as={Input} id="vehicle-renavam" name="renavam" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle-chassis">{t("vehicles.chassis")}</Label>
                    <Field as={Input} id="vehicle-chassis" name="chassis" />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="vehicle-inactive"
                    checked={values.inactive}
                    onCheckedChange={(v) => setFieldValue("inactive", v === true)}
                  />
                  <Label htmlFor="vehicle-inactive" className="font-normal">
                    {t("vehicles.inactive")}
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicle-notes">{t("vehicles.notes")}</Label>
                  <Field
                    as={Textarea}
                    id="vehicle-notes"
                    name="notes"
                    placeholder={t("vehicles.notesPlaceholder")}
                    rows={3}
                  />
                </div>
              </div>

              {isEdit ? (
                <div className="space-y-2">
                  <Label htmlFor="vehicle-device">{t("vehicles.device")}</Label>
                  <Select
                    value={values.trackerDeviceId || "none"}
                    onValueChange={(v) =>
                      setFieldValue("trackerDeviceId", v === "none" ? "" : v)
                    }
                    disabled={loadingDevices}
                  >
                    <SelectTrigger id="vehicle-device">
                      <SelectValue placeholder={t("vehicles.noDevice")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("vehicles.noDevice")}</SelectItem>
                      {devices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          <span className="font-mono text-xs">{d.imei}</span>
                          <span className="text-muted-foreground ml-1">
                            ({d.model})
                            {d.name ? ` · ${d.name}` : ""}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>{t("vehicles.deviceAssociation")}</Label>
                    <Select
                      value={values.deviceOption}
                      onValueChange={(v) =>
                        setFieldValue("deviceOption", v as DeviceOption)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t("vehicles.deviceOptionNone")}
                        </SelectItem>
                        <SelectItem value="existing">
                          {t("vehicles.deviceOptionExisting")}
                        </SelectItem>
                        <SelectItem value="new">
                          {t("vehicles.deviceOptionNew")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {values.deviceOption === "existing" && (
                    <div className="space-y-2">
                      <Label htmlFor="vehicle-device">{t("vehicles.device")}</Label>
                      <Select
                        value={values.trackerDeviceId || "none"}
                        onValueChange={(v) =>
                          setFieldValue(
                            "trackerDeviceId",
                            v === "none" ? "" : v
                          )
                        }
                        disabled={loadingDevices}
                      >
                        <SelectTrigger id="vehicle-device">
                          <SelectValue placeholder={t("vehicles.noDevice")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            {t("vehicles.noDevice")}
                          </SelectItem>
                          {devices.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              <span className="font-mono text-xs">{d.imei}</span>
                              <span className="text-muted-foreground ml-1">
                                ({d.model})
                                {d.name ? ` · ${d.name}` : ""}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {values.deviceOption === "new" && (
                    <div className="space-y-4 rounded-lg border p-4">
                      <h3 className="text-sm font-medium">
                        {t("vehicles.sectionDevice")}
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="new-device-imei">
                            {t("vehicles.imei")}
                          </Label>
                          <Field
                            as={Input}
                            id="new-device-imei"
                            name="newImei"
                            placeholder={t("vehicles.imeiPlaceholder")}
                            className={`font-mono ${
                              errors.newImei ? "border-destructive" : ""
                            }`}
                          />
                          <ErrorMessage
                            name="newImei"
                            component="div"
                            className="text-destructive text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-device-model">
                            {t("vehicles.trackerModel")}
                          </Label>
                          <Select
                            value={values.newModel}
                            onValueChange={(v) => setFieldValue("newModel", v)}
                          >
                            <SelectTrigger id="new-device-model">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TRACKER_MODELS.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="new-device-name">
                            {t("vehicles.deviceNameOptional")}
                          </Label>
                          <Field
                            as={Input}
                            id="new-device-name"
                            name="newDeviceName"
                            placeholder={t("common.name")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-device-equipmentModel">
                            {t("vehicles.equipmentModel")}
                          </Label>
                          <Field
                            as={Input}
                            id="new-device-equipmentModel"
                            name="newEquipmentModel"
                            placeholder="Ex: SUNT CH"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-device-serialSat">
                            {t("vehicles.serialSat")}
                          </Label>
                          <Field
                            as={Input}
                            id="new-device-serialSat"
                            name="newSerialSat"
                            className="font-mono"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="new-device-individualPassword">
                            {t("vehicles.individualPassword")}
                          </Label>
                          <Field
                            as={Input}
                            id="new-device-individualPassword"
                            name="newIndividualPassword"
                            type="password"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                      <h3 className="text-sm font-medium pt-2">
                        {t("vehicles.sectionSimData")}
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="new-device-carrier">
                            {t("vehicles.carrier")}
                          </Label>
                          <Field
                            as={Input}
                            id="new-device-carrier"
                            name="newCarrier"
                            placeholder="Ex: SMARTSIM"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-device-simCardNumber">
                            {t("vehicles.simCardNumber")}
                          </Label>
                          <Field
                            as={Input}
                            id="new-device-simCardNumber"
                            name="newSimCardNumber"
                            className="font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-device-cellNumber">
                            {t("vehicles.cellNumber")}
                          </Label>
                          <Field
                            as={Input}
                            id="new-device-cellNumber"
                            name="newCellNumber"
                            placeholder="Ex: 16995636896"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <DialogFooter>
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
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import {
  checklistAPI,
  vehiclesAPI,
  driversAPI,
  type ChecklistTemplate,
  type Vehicle,
  type Driver,
  type CreateChecklistEntryPayload,
} from "@/lib/frontend/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ResourceSelectCreateRow } from "@/components/resource-select-create-row";
import { VehicleFormDialog } from "@/app/dashboard/vehicles/vehicle-form-dialog";
import { DriverFormDialog } from "@/app/dashboard/drivers/driver-form-dialog";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { ChecklistSignatureField } from "@/components/checklist/checklist-signature-field";
import {
  getChecklistAttachmentPhotoUrl,
  parseChecklistAttachment,
  stringifyChecklistAttachment,
} from "@/lib/checklist-answer-utils";
import { DrawerStackParentDim } from "@/components/drawer-stack-parent-dim";
import { SheetFooter } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const CHECKLIST_FILL_FORM_ID = "rsf-checklist-fill-form";

/** Radix Select não permite SelectItem com value="". */
const NO_DRIVER_SELECT_VALUE = "__checklist_no_driver__";
const NO_VEHICLE_SELECT_VALUE = "__checklist_no_vehicle__";

const EMPTY_SELECT_PREFIX = "__rsf_select_empty__";

function selectItemValue(itemId: string, option: string, index: number): string {
  return option === "" ? `${EMPTY_SELECT_PREFIX}${itemId}:${index}` : option;
}

function answerFromSelectValue(itemId: string, value: string): string {
  if (!value.startsWith(EMPTY_SELECT_PREFIX)) return value;
  const rest = value.slice(EMPTY_SELECT_PREFIX.length);
  const colon = rest.indexOf(":");
  if (colon < 0) return value;
  if (rest.slice(0, colon) !== itemId) return value;
  return "";
}

function selectControlValue(
  itemId: string,
  answer: string | undefined,
  options: string[],
): string {
  if (answer === undefined) return "";
  if (answer !== "") return answer;
  const idx = options.findIndex((o) => o === "");
  if (idx < 0) return "";
  return `${EMPTY_SELECT_PREFIX}${itemId}:${idx}`;
}

function isRequiredItemAnswerInvalid(
  item: ChecklistTemplate["items"][number],
  raw: string | undefined,
): boolean {
  if (item.type === "PHOTO" || item.type === "FILE") {
    return !getChecklistAttachmentPhotoUrl(raw);
  }
  return !raw?.trim();
}

export type ChecklistFillFormVariant = "page" | "sheet";

export type ChecklistFillFormProps = {
  templateId: string;
  organizationId: string;
  selectedCustomerId?: string | null;
  initialVehicleId?: string | null;
  initialDriverId?: string | null;
  variant: ChecklistFillFormVariant;
  onSuccess: () => void;
  onCancel: () => void;
  /** When template/vehicles fail to load (defaults to onCancel). */
  onLoadError?: () => void;
};

type FieldErrors = {
  vehicle: boolean;
  driver: boolean;
  items: Record<string, boolean>;
};

const emptyErrors = (): FieldErrors => ({ vehicle: false, driver: false, items: {} });

export function ChecklistFillForm({
  templateId,
  organizationId,
  selectedCustomerId,
  initialVehicleId,
  initialDriverId,
  variant,
  onSuccess,
  onCancel,
  onLoadError,
}: ChecklistFillFormProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();

  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attachmentUploadingId, setAttachmentUploadingId] = useState<string | null>(null);
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [driverFormOpen, setDriverFormOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(emptyErrors);

  const orgId = organizationId;
  const canCreateVehicle = can(Module.VEHICLES, Action.CREATE);
  const canCreateDriver = can(Module.DRIVERS, Action.CREATE);

  useEffect(() => {
    if (!orgId || !templateId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [templateRes, vehiclesRes, driversRes] = await Promise.all([
          checklistAPI.getTemplate(orgId, templateId),
          vehiclesAPI.list(orgId),
          driversAPI.list(orgId),
        ]);

        setTemplate(templateRes.data);
        setVehicles(vehiclesRes.data ?? []);
        setDrivers(driversRes.data?.drivers ?? []);

        if (initialVehicleId) setSelectedVehicle(initialVehicleId);
        if (initialDriverId) setSelectedDriver(initialDriverId);
      } catch (err) {
        console.error("Failed to load checklist data:", err);
        toast.error(t("checklist.toastError"));
        (onLoadError ?? onCancel)();
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit onCancel/onLoadError to avoid reload loops
  }, [orgId, templateId, initialVehicleId, initialDriverId, t]);

  useEffect(() => {
    if (!template) return;
    if (template.driverRequirement === "HIDDEN") {
      setSelectedDriver("");
    }
  }, [template?.id, template?.driverRequirement]);

  const clearVehicleError = () =>
    setFieldErrors((e) => (e.vehicle ? { ...e, vehicle: false } : e));
  const clearDriverError = () =>
    setFieldErrors((e) => (e.driver ? { ...e, driver: false } : e));
  const clearItemError = (itemId: string) =>
    setFieldErrors((e) => {
      if (!e.items[itemId]) return e;
      const next = { ...e.items };
      delete next[itemId];
      return { ...e, items: next };
    });

  const handleAnswerChange = (itemId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
    clearItemError(itemId);
  };

  const refreshVehiclesSilently = () => {
    vehiclesAPI
      .list(orgId)
      .then((res) => setVehicles(res.data ?? []))
      .catch(() => setVehicles([]));
  };

  const refreshDriversSilently = () => {
    driversAPI
      .list(orgId)
      .then((res) => setDrivers(res.data?.drivers ?? []))
      .catch(() => setDrivers([]));
  };

  const runValidation = (): boolean => {
    if (!template) return false;

    const { vehicleRequired, driverRequirement: driverReq } = template;
    const next: FieldErrors = { vehicle: false, driver: false, items: {} };

    if (vehicleRequired && !selectedVehicle) next.vehicle = true;
    if (driverReq === "REQUIRED" && !selectedDriver) next.driver = true;

    const requiredItems = template.items.filter((item) => item.required);
    for (const item of requiredItems) {
      const raw = answers[item.id];
      if (isRequiredItemAnswerInvalid(item, raw)) {
        next.items[item.id] = true;
      }
    }

    setFieldErrors(next);
    const hasErrors =
      next.vehicle || next.driver || Object.keys(next.items).length > 0;
    if (hasErrors) {
      requestAnimationFrame(() => {
        document
          .querySelector("[data-checklist-error]")
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
    return !hasErrors;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!orgId || !template) return;
    if (!runValidation()) return;

    const { driverRequirement: driverReq } = template;

    try {
      setSubmitting(true);

      const payload: CreateChecklistEntryPayload = {
        templateId,
        ...(selectedVehicle ? { vehicleId: selectedVehicle } : {}),
        ...(driverReq !== "HIDDEN" && selectedDriver ? { driverId: selectedDriver } : {}),
        answers: Object.entries(answers).map(([itemId, raw]) => {
          const item = template.items.find((i) => i.id === itemId);
          if (item?.type === "PHOTO" || item?.type === "FILE") {
            const att = parseChecklistAttachment(raw);
            const meta =
              att?.originalName || att?.mimeType
                ? JSON.stringify({
                    originalName: att.originalName,
                    mimeType: att.mimeType,
                  })
                : undefined;
            return {
              itemId,
              value: meta,
              photoUrl: att?.photoUrl,
            };
          }
          return { itemId, value: raw, photoUrl: undefined };
        }),
      };

      await checklistAPI.createEntry(orgId, payload);
      toast.success(t("checklist.toastEntryCreated"));
      setFieldErrors(emptyErrors());
      onSuccess();
    } catch (err) {
      console.error("Failed to create checklist entry:", err);
      toast.error(t("checklist.toastError"));
    } finally {
      setSubmitting(false);
    }
  };

  const hideDialogOverlay = variant === "sheet";

  const formBody = template ? (
    <form
      id={CHECKLIST_FILL_FORM_ID}
      className="space-y-6"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <div
        className="space-y-2"
        data-checklist-error={fieldErrors.vehicle ? "" : undefined}
      >
        <Label htmlFor="checklist-vehicle">
          {t("checklist.selectVehicle")}
          {template.vehicleRequired ? " *" : ` (${t("common.optional")})`}
        </Label>
        <ResourceSelectCreateRow
          showCreate={canCreateVehicle}
          createLabel={t("common.createNewVehicle")}
          onCreateClick={() => setVehicleFormOpen(true)}
          disabled={submitting}
        >
          <Select
            value={
              !template.vehicleRequired && selectedVehicle === ""
                ? NO_VEHICLE_SELECT_VALUE
                : selectedVehicle
            }
            onValueChange={(v) => {
              setSelectedVehicle(v === NO_VEHICLE_SELECT_VALUE ? "" : v);
              clearVehicleError();
            }}
          >
            <SelectTrigger
              id="checklist-vehicle"
              className={cn("w-full", fieldErrors.vehicle && "border-destructive ring-1 ring-destructive")}
            >
              <SelectValue placeholder={t("checklist.selectVehiclePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {!template.vehicleRequired && (
                <SelectItem value={NO_VEHICLE_SELECT_VALUE}>
                  {t("checklist.noVehicle")}
                </SelectItem>
              )}
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.name ?? "—"} ({vehicle.plate ?? "—"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ResourceSelectCreateRow>
        {fieldErrors.vehicle && (
          <p className="text-sm text-destructive">{t("checklist.vehicleRequired")}</p>
        )}
      </div>

      {template.driverRequirement !== "HIDDEN" && (
        <div
          className="space-y-2"
          data-checklist-error={fieldErrors.driver ? "" : undefined}
        >
          <Label htmlFor="checklist-driver">
            {t("checklist.driver")}
            {template.driverRequirement === "REQUIRED"
              ? " *"
              : ` (${t("common.optional")})`}
          </Label>
          {template.driverRequirement === "REQUIRED" &&
          drivers.length === 0 &&
          !canCreateDriver ? (
            <p className="text-sm text-destructive">{t("checklist.driverRequiredButNone")}</p>
          ) : (
            <ResourceSelectCreateRow
              showCreate={canCreateDriver}
              createLabel={t("common.createNewDriver")}
              onCreateClick={() => setDriverFormOpen(true)}
              disabled={submitting}
            >
              <Select
                value={selectedDriver === "" ? NO_DRIVER_SELECT_VALUE : selectedDriver}
                onValueChange={(v) => {
                  setSelectedDriver(v === NO_DRIVER_SELECT_VALUE ? "" : v);
                  clearDriverError();
                }}
              >
                <SelectTrigger
                  id="checklist-driver"
                  className={cn("w-full", fieldErrors.driver && "border-destructive ring-1 ring-destructive")}
                >
                  <SelectValue placeholder={t("checklist.driverPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {template.driverRequirement === "OPTIONAL" && (
                    <SelectItem value={NO_DRIVER_SELECT_VALUE}>
                      {t("checklist.noDriver")}
                    </SelectItem>
                  )}
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ResourceSelectCreateRow>
          )}
          {fieldErrors.driver && (
            <p className="text-sm text-destructive">{t("checklist.driverRequired")}</p>
          )}
        </div>
      )}

      <div className="space-y-6 border-t pt-6">
        {[...template.items]
          .sort((a, b) => a.order - b.order)
          .map((item) => {
            const itemErr = !!fieldErrors.items[item.id];
            return (
              <div
                key={item.id}
                className="space-y-2"
                data-checklist-error={itemErr ? "" : undefined}
              >
                <Label>
                  {item.label}
                  {item.required && " *"}
                </Label>

                {item.type === "YES_NO" && (
                  <div
                    className={cn(
                      "rounded-md border p-3",
                      itemErr && "border-destructive ring-1 ring-destructive",
                    )}
                  >
                    <RadioGroup
                      value={answers[item.id] || ""}
                      onValueChange={(value) => handleAnswerChange(item.id, value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true" id={`${item.id}-yes`} />
                        <Label htmlFor={`${item.id}-yes`} className="font-normal cursor-pointer">
                          Sim
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="false" id={`${item.id}-no`} />
                        <Label htmlFor={`${item.id}-no`} className="font-normal cursor-pointer">
                          Não
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {item.type === "TEXT" && (
                  <Textarea
                    placeholder={item.label}
                    value={answers[item.id] || ""}
                    onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                    className={cn(itemErr && "border-destructive ring-1 ring-destructive")}
                  />
                )}

                {item.type === "NUMBER" && (
                  <Input
                    type="number"
                    placeholder={item.label}
                    value={answers[item.id] || ""}
                    onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                    className={cn(itemErr && "border-destructive ring-1 ring-destructive")}
                  />
                )}

                {item.type === "PHOTO" && (
                  <div
                    className={cn(
                      "space-y-2 rounded-md border border-transparent p-2",
                      itemErr && "border-destructive ring-1 ring-destructive",
                    )}
                  >
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={submitting || attachmentUploadingId === item.id}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !orgId) return;
                        setAttachmentUploadingId(item.id);
                        try {
                          const { data } = await checklistAPI.uploadAttachment(orgId, file, "photo");
                          setAnswers((prev) => ({
                            ...prev,
                            [item.id]: stringifyChecklistAttachment({
                              photoUrl: data.fileUrl,
                              originalName: file.name,
                              mimeType: file.type || data.mimeType,
                            }),
                          }));
                          clearItemError(item.id);
                        } catch {
                          toast.error(t("checklist.toastError"));
                        } finally {
                          setAttachmentUploadingId(null);
                          e.target.value = "";
                        }
                      }}
                    />
                    {attachmentUploadingId === item.id && (
                      <p className="text-xs text-muted-foreground">{t("checklist.uploadingAttachment")}</p>
                    )}
                    {getChecklistAttachmentPhotoUrl(answers[item.id]) && (
                      <img
                        src={getChecklistAttachmentPhotoUrl(answers[item.id])!}
                        alt=""
                        className="h-24 w-auto rounded border object-cover"
                      />
                    )}
                  </div>
                )}

                {item.type === "SELECT" && (
                  <Select
                    value={selectControlValue(item.id, answers[item.id], item.options)}
                    onValueChange={(value) =>
                      handleAnswerChange(item.id, answerFromSelectValue(item.id, value))
                    }
                  >
                    <SelectTrigger
                      className={cn(itemErr && "border-destructive ring-1 ring-destructive")}
                    >
                      <SelectValue placeholder={`Selecione ${item.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {item.options.map((option, idx) => (
                        <SelectItem key={`${item.id}-${idx}`} value={selectItemValue(item.id, option, idx)}>
                          {option || "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {item.type === "SIGNATURE" && (
                  <div
                    className={cn(
                      "rounded-md border border-transparent p-2",
                      itemErr && "border-destructive ring-1 ring-destructive",
                    )}
                  >
                    <ChecklistSignatureField
                      value={answers[item.id] ?? ""}
                      onChange={(v) => {
                        setAnswers((prev) => ({ ...prev, [item.id]: v }));
                        clearItemError(item.id);
                      }}
                      disabled={submitting}
                      uploadPngBlob={async (blob) => {
                        const file = new File([blob], "signature.png", { type: "image/png" });
                        const { data } = await checklistAPI.uploadAttachment(orgId, file, "signature");
                        return data.fileUrl;
                      }}
                    />
                  </div>
                )}

                {item.type === "FILE" && (
                  <div
                    className={cn(
                      "space-y-2 rounded-md border border-transparent p-2",
                      itemErr && "border-destructive ring-1 ring-destructive",
                    )}
                  >
                    <Input
                      type="file"
                      disabled={submitting || attachmentUploadingId === item.id}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !orgId) return;
                        setAttachmentUploadingId(item.id);
                        try {
                          const { data } = await checklistAPI.uploadAttachment(orgId, file, "file");
                          setAnswers((prev) => ({
                            ...prev,
                            [item.id]: stringifyChecklistAttachment({
                              photoUrl: data.fileUrl,
                              originalName: file.name,
                              mimeType: file.type || data.mimeType,
                            }),
                          }));
                          clearItemError(item.id);
                        } catch {
                          toast.error(t("checklist.toastError"));
                        } finally {
                          setAttachmentUploadingId(null);
                          e.target.value = "";
                        }
                      }}
                    />
                    {attachmentUploadingId === item.id && (
                      <p className="text-xs text-muted-foreground">{t("checklist.uploadingAttachment")}</p>
                    )}
                    {parseChecklistAttachment(answers[item.id])?.originalName && (
                      <p className="text-xs text-muted-foreground">
                        {parseChecklistAttachment(answers[item.id])?.originalName}
                      </p>
                    )}
                  </div>
                )}

                {itemErr && (
                  <p className="text-sm text-destructive">{t("checklist.fieldRequired")}</p>
                )}
              </div>
            );
          })}
      </div>

      {variant === "page" && (
        <div className="flex gap-2 border-t pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={submitting || !!attachmentUploadingId}
            className="flex-1"
          >
            {submitting ? t("checklist.submitting") : t("checklist.submitChecklist")}
          </Button>
        </div>
      )}
    </form>
  ) : null;

  if (loading) {
    if (variant === "sheet") {
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{t("checklist.fillChecklist")}</h1>
        <p className="text-center text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!template) {
    if (variant === "sheet") {
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
          {t("checklist.toastError")}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{t("checklist.fillChecklist")}</h1>
        <p className="text-center text-muted-foreground">{t("checklist.toastError")}</p>
      </div>
    );
  }

  const inner = (
    <>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("checklist.fillChecklist")}</CardTitle>
        </CardHeader>
        <CardContent>{formBody}</CardContent>
      </Card>

      <VehicleFormDialog
        open={vehicleFormOpen}
        onOpenChange={setVehicleFormOpen}
        vehicle={null}
        organizationId={orgId}
        defaultCustomerId={selectedCustomerId ?? undefined}
        hideOverlay={hideDialogOverlay}
        onSuccess={(created) => {
          refreshVehiclesSilently();
          if (created?.id) setSelectedVehicle(created.id);
        }}
      />
      <DriverFormDialog
        open={driverFormOpen}
        onOpenChange={setDriverFormOpen}
        driver={null}
        organizationId={orgId}
        defaultCustomerId={selectedCustomerId ?? undefined}
        hideOverlay={hideDialogOverlay}
        onSuccess={(created) => {
          refreshDriversSilently();
          if (created?.id) setSelectedDriver(created.id);
        }}
      />
    </>
  );

  if (variant === "page") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{template.name}</h1>
        </div>
        {inner}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {formBody}
        <DrawerStackParentDim show={vehicleFormOpen || driverFormOpen} />
      </div>
      <SheetFooter className="gap-2 border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          form={CHECKLIST_FILL_FORM_ID}
          disabled={submitting || !!attachmentUploadingId}
          className="flex-1 sm:flex-none"
        >
          {submitting ? t("checklist.submitting") : t("checklist.submitChecklist")}
        </Button>
      </SheetFooter>
      <VehicleFormDialog
        open={vehicleFormOpen}
        onOpenChange={setVehicleFormOpen}
        vehicle={null}
        organizationId={orgId}
        defaultCustomerId={selectedCustomerId ?? undefined}
        hideOverlay={hideDialogOverlay}
        onSuccess={(created) => {
          refreshVehiclesSilently();
          if (created?.id) setSelectedVehicle(created.id);
        }}
      />
      <DriverFormDialog
        open={driverFormOpen}
        onOpenChange={setDriverFormOpen}
        driver={null}
        organizationId={orgId}
        defaultCustomerId={selectedCustomerId ?? undefined}
        hideOverlay={hideDialogOverlay}
        onSuccess={(created) => {
          refreshDriversSilently();
          if (created?.id) setSelectedDriver(created.id);
        }}
      />
    </div>
  );
}

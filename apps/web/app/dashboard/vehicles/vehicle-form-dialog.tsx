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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  vehiclesAPI,
  trackerDevicesAPI,
  customersAPI,
  type Vehicle,
  type Customer,
  type CreateVehiclePayload,
  type UpdateVehiclePayload,
} from "@/lib/frontend/api-client";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ResourceSelectCreateRow } from "@/components/resource-select-create-row";
import { DrawerStackParentDim } from "@/components/drawer-stack-parent-dim";
import { CustomerFormDialog } from "@/app/dashboard/customers/customer-form-dialog";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { useAuth } from "@/lib/hooks/use-auth";
import { onRhfInvalidSubmit } from "@/lib/on-rhf-invalid-submit";
import { getApiErrorMessage } from "@/lib/api-error-message";
import {
  VEHICLE_BODY_TYPES,
  VEHICLE_SPECIES,
  VEHICLE_TRACTIONS,
  VEHICLE_USE_CATEGORIES,
  type VehicleSpeciesGroupKey,
} from "@gleandroj/shared";

const CLASSIFICATION_SELECT_NONE = "__none__";

const SPECIES_GROUP_ORDER: readonly VehicleSpeciesGroupKey[] = [
  "passenger",
  "cargo",
  "mixed",
  "special",
  "competition",
];

function classificationFieldForApi(
  value: string,
  isEdit: boolean,
): string | undefined | null {
  const v = value?.trim() ?? "";
  if (!v) return isEdit ? null : undefined;
  return v;
}

/** Placa BR (padrão antigo ou Mercosul): até 7 caracteres alfanuméricos + hífen após a 3ª posição. */
function maskPlate(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
}

function plateToApi(value: string): string {
  return value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

type DeviceOption = "none" | "existing" | "new";

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  organizationId: string;
  onSuccess: (created?: Vehicle) => void;
  defaultCustomerId?: string | null;
  /** Avoid stacking a second dimming overlay when this sheet opens over another modal/sheet. */
  hideOverlay?: boolean;
}

interface TrackerDeviceOption {
  id: string;
  imei: string;
  model: string;
  name?: string | null;
  vehicleId?: string | null;
}

type VehicleFormValues = z.infer<ReturnType<typeof buildSchema>>;

function buildSchema(t: (k: string) => string, isEdit: boolean) {
  return z
    .object({
      name: z.string().default(""),
      plate: z.string().min(1, t("vehicles.plateRequired")),
      serial: z.string().default(""),
      color: z.string().default(""),
      year: z.string().default(""),
      renavam: z.string().default(""),
      chassis: z.string().default(""),
      vehicleSpecies: z.string().default(""),
      vehicleBodyType: z.string().default(""),
      vehicleTraction: z.string().default(""),
      vehicleUseCategory: z.string().default(""),
      inactive: z.boolean().default(false),
      speedLimit: z.string().default(""),
      initialOdometerKm: z
        .string()
        .default("")
        .refine(
          (s) => {
            const trimmed = s?.trim() ?? "";
            if (!trimmed) return true;
            const n = parseFloat(trimmed.replace(",", "."));
            return Number.isFinite(n) && n >= 0 && n <= 9_999_999_999;
          },
          { message: t("vehicles.initialOdometerInvalid") },
        ),
      notes: z.string().default(""),
      customerId: isEdit
        ? z.string().default("")
        : z.string().min(1, t("vehicles.customerRequired")),
      trackerDeviceId: z.string().default(""),
      deviceOption: z.enum(["none", "existing", "new"]).default("none"),
      newImei: z.string().default(""),
      newDeviceName: z.string().default(""),
      newSerialSat: z.string().default(""),
      newEquipmentModel: z.string().default(""),
      newIndividualPassword: z.string().default(""),
      newCarrier: z.string().default(""),
      newSimCardNumber: z.string().default(""),
      newCellNumber: z.string().default(""),
    })
    .refine(
      (data) =>
        data.deviceOption !== "new" || (data.newImei?.trim() ?? "") !== "",
      { message: t("vehicles.imeiRequired"), path: ["newImei"] }
    );
}

function defaultValues(
  vehicle: Vehicle | null,
  isEdit: boolean,
  defaultCustomerId?: string | null
): VehicleFormValues {
  return {
    name: vehicle?.name ?? "",
    plate: vehicle?.plate ? maskPlate(vehicle.plate) : "",
    serial: vehicle?.serial ?? "",
    color: vehicle?.color ?? "",
    year: vehicle?.year ?? "",
    renavam: vehicle?.renavam ?? "",
    chassis: vehicle?.chassis ?? "",
    vehicleSpecies: vehicle?.vehicleSpecies ?? "",
    vehicleBodyType: vehicle?.vehicleBodyType ?? "",
    vehicleTraction: vehicle?.vehicleTraction ?? "",
    vehicleUseCategory: vehicle?.vehicleUseCategory ?? "",
    inactive: vehicle?.inactive ?? false,
    speedLimit:
      vehicle?.speedLimit != null && Number.isFinite(vehicle.speedLimit)
        ? String(vehicle.speedLimit)
        : "",
    initialOdometerKm:
      vehicle?.initialOdometerKm != null &&
      Number.isFinite(vehicle.initialOdometerKm)
        ? String(vehicle.initialOdometerKm)
        : "",
    notes: vehicle?.notes ?? "",
    customerId: isEdit ? (vehicle?.customerId ?? "") : (defaultCustomerId ?? ""),
    trackerDeviceId: vehicle?.trackerDeviceId ?? "",
    deviceOption: "none",
    newImei: "",
    newDeviceName: "",
    newSerialSat: "",
    newEquipmentModel: "",
    newIndividualPassword: "",
    newCarrier: "",
    newSimCardNumber: "",
    newCellNumber: "",
  };
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  vehicle,
  organizationId,
  onSuccess,
  defaultCustomerId,
  hideOverlay = false,
}: VehicleFormDialogProps) {
  const { t } = useTranslation();
  const { user, selectedCustomerId, currentOrganization } = useAuth();
  const { can } = usePermissions();
  const isEdit = !!vehicle;
  const canEditVehicle = can(Module.VEHICLES, Action.EDIT);

  const ensureCustomerInList = async (
    list: Customer[],
    ensureCustomerId?: string,
  ): Promise<Customer[]> => {
    if (!ensureCustomerId || list.some((c) => c.id === ensureCustomerId)) {
      return list;
    }
    try {
      const { data } = await customersAPI.get(organizationId, ensureCustomerId);
      return [...list, data];
    } catch {
      return list;
    }
  };

  const [devices, setDevices] = useState<TrackerDeviceOption[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(buildSchema(t, isEdit)),
    defaultValues: defaultValues(vehicle, isEdit, defaultCustomerId),
  });

  const { isSubmitting } = form.formState;
  const deviceOption = form.watch("deviceOption");
  const customerId = form.watch("customerId");

  useEffect(() => {
    if (open && isEdit && !canEditVehicle) {
      onOpenChange(false);
    }
  }, [open, isEdit, canEditVehicle, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const effectiveDefault =
      !isEdit && customers.length > 0
        ? defaultCustomerId && customers.some((c) => c.id === defaultCustomerId)
          ? defaultCustomerId
          : customers.length === 1
            ? customers[0].id
            : defaultCustomerId
        : defaultCustomerId;
    form.reset(defaultValues(vehicle, isEdit, effectiveDefault));
  }, [open, vehicle?.id]);

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoadingDevices(true);
    trackerDevicesAPI
      .list(organizationId)
      .then((res) => setDevices(Array.isArray(res.data) ? res.data : []))
      .catch(() => setDevices([]))
      .finally(() => setLoadingDevices(false));
  }, [open, organizationId]);

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoadingCustomers(true);
    customersAPI
      .list(organizationId, { activeOnly: true })
      .then(async (res) => {
        const list = res.data?.customers ?? [];
        const normalized = Array.isArray(list) ? list : [];
        const withCurrent = await ensureCustomerInList(
          normalized,
          isEdit ? vehicle?.customerId ?? undefined : undefined,
        );
        setCustomers(withCurrent);
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [open, organizationId, isEdit, vehicle?.customerId]);

  const handleSubmit = async (values: VehicleFormValues) => {
    const base = {
      name: values.name?.trim() || undefined,
      plate: plateToApi(values.plate),
      serial: values.serial?.trim() || undefined,
      color: values.color?.trim() || undefined,
      year: values.year?.trim() || undefined,
      renavam: values.renavam?.trim() || undefined,
      chassis: values.chassis?.trim() || undefined,
      vehicleSpecies: classificationFieldForApi(values.vehicleSpecies, isEdit),
      vehicleBodyType: classificationFieldForApi(values.vehicleBodyType, isEdit),
      vehicleTraction: classificationFieldForApi(values.vehicleTraction, isEdit),
      vehicleUseCategory: classificationFieldForApi(
        values.vehicleUseCategory,
        isEdit,
      ),
      inactive: values.inactive,
      speedLimit: (() => {
        const s = values.speedLimit?.trim();
        if (!s) return isEdit ? null : undefined;
        const n = parseFloat(s.replace(",", "."));
        if (!Number.isFinite(n)) return isEdit ? null : undefined;
        return n;
      })(),
      initialOdometerKm: (() => {
        const s = values.initialOdometerKm?.trim();
        if (!s) return isEdit ? null : undefined;
        const n = parseFloat(s.replace(",", "."));
        if (!Number.isFinite(n)) return isEdit ? null : undefined;
        return n;
      })(),
      notes: values.notes?.trim() || undefined,
      customerId: values.customerId?.trim() || undefined,
    };

    let payload: CreateVehiclePayload | UpdateVehiclePayload;
    if (isEdit) {
      payload = { ...base, trackerDeviceId: values.trackerDeviceId || undefined };
    } else if (values.deviceOption === "new" && values.newImei?.trim()) {
      payload = {
        ...base,
        newDevice: {
          imei: values.newImei.trim(),
          model: "X12_GT06",
          name: values.newDeviceName?.trim() || undefined,
          serialSat: values.newSerialSat?.trim() || undefined,
          equipmentModel: values.newEquipmentModel?.trim() || undefined,
          individualPassword: values.newIndividualPassword?.trim() || undefined,
          carrier: values.newCarrier?.trim() || undefined,
          simCardNumber: values.newSimCardNumber?.trim() || undefined,
          cellNumber: values.newCellNumber?.trim() || undefined,
        },
      };
    } else if (values.deviceOption === "existing" && values.trackerDeviceId) {
      payload = { ...base, trackerDeviceId: values.trackerDeviceId };
    } else {
      payload = base;
    }

    try {
      if (isEdit) {
        await vehiclesAPI.update(organizationId, vehicle!.id, payload as UpdateVehiclePayload);
        toast.success(t("vehicles.toastUpdated"));
        onSuccess();
      } else {
        const { data: created } = await vehiclesAPI.create(
          organizationId,
          payload as CreateVehiclePayload
        );
        toast.success(t("vehicles.toastCreated"));
        onSuccess(created);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t, "vehicles.toastError"));
    }
  };

  const customerRequired = !isEdit;
  const customerPlaceholder = customerRequired ? t("vehicles.selectClient") : t("customers.noParent");
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const canCreateCompany = can(Module.COMPANIES, Action.CREATE);

  const refreshCustomersList = () => {
    if (!organizationId) return;
    customersAPI
      .list(organizationId, { activeOnly: true })
      .then(async (res) => {
        const list = res.data?.customers ?? [];
        const normalized = Array.isArray(list) ? list : [];
        const withCurrent = await ensureCustomerInList(
          normalized,
          isEdit ? vehicle?.customerId ?? undefined : undefined,
        );
        setCustomers(withCurrent);
      })
      .catch(() => setCustomers([]));
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        hideOverlay={hideOverlay}
        className="sm:max-w-lg flex flex-col p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>
            {isEdit ? t("vehicles.editVehicle") : t("vehicles.createVehicle")}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit, onRhfInvalidSubmit(form, t))}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Dados Gerais */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  {t("vehicles.sectionGeneral")}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.name")}</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: FIAT/PALIO FIRE" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="plate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("vehicles.plate")} *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("vehicles.platePlaceholder")}
                            className="font-mono uppercase"
                            maxLength={8}
                            autoCapitalize="characters"
                            inputMode="text"
                            name={field.name}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(maskPlate(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="serial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("vehicles.serial")}</FormLabel>
                        <FormControl>
                          <Input className="font-mono" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("vehicles.color")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("vehicles.year")}</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 2015" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="sm:col-span-2 space-y-3 pt-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                      {t("vehicles.classification.section")}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="vehicleSpecies"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("vehicles.classification.speciesField")}</FormLabel>
                            <Select
                              value={field.value || CLASSIFICATION_SELECT_NONE}
                              onValueChange={(v) =>
                                field.onChange(
                                  v === CLASSIFICATION_SELECT_NONE ? "" : v,
                                )
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={CLASSIFICATION_SELECT_NONE}>
                                  {t("vehicles.classification.none")}
                                </SelectItem>
                                {SPECIES_GROUP_ORDER.map((group) => (
                                  <SelectGroup key={group}>
                                    <SelectLabel>
                                      {t(`vehicles.classification.speciesGroup.${group}`)}
                                    </SelectLabel>
                                    {VEHICLE_SPECIES.filter((s) => s.group === group).map(
                                      (s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                          {t(`vehicles.classification.species.${s.value}`)}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vehicleBodyType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("vehicles.classification.bodyTypeField")}</FormLabel>
                            <Select
                              value={field.value || CLASSIFICATION_SELECT_NONE}
                              onValueChange={(v) =>
                                field.onChange(
                                  v === CLASSIFICATION_SELECT_NONE ? "" : v,
                                )
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={CLASSIFICATION_SELECT_NONE}>
                                  {t("vehicles.classification.none")}
                                </SelectItem>
                                {VEHICLE_BODY_TYPES.map((code) => (
                                  <SelectItem key={code} value={code}>
                                    {t(`vehicles.classification.bodyType.${code}`)}
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
                        name="vehicleTraction"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("vehicles.classification.tractionField")}</FormLabel>
                            <Select
                              value={field.value || CLASSIFICATION_SELECT_NONE}
                              onValueChange={(v) =>
                                field.onChange(
                                  v === CLASSIFICATION_SELECT_NONE ? "" : v,
                                )
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={CLASSIFICATION_SELECT_NONE}>
                                  {t("vehicles.classification.none")}
                                </SelectItem>
                                {VEHICLE_TRACTIONS.map((code) => (
                                  <SelectItem key={code} value={code}>
                                    {t(`vehicles.classification.traction.${code}`)}
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
                        name="vehicleUseCategory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("vehicles.classification.useCategoryField")}
                            </FormLabel>
                            <Select
                              value={field.value || CLASSIFICATION_SELECT_NONE}
                              onValueChange={(v) =>
                                field.onChange(
                                  v === CLASSIFICATION_SELECT_NONE ? "" : v,
                                )
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={CLASSIFICATION_SELECT_NONE}>
                                  {t("vehicles.classification.none")}
                                </SelectItem>
                                {VEHICLE_USE_CATEGORIES.map((code) => (
                                  <SelectItem key={code} value={code}>
                                    {t(`vehicles.classification.useCategory.${code}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="renavam"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("vehicles.renavam")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="chassis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("vehicles.chassis")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="inactive"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        {t("vehicles.inactive")}
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="speedLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("vehicles.speedLimit")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="80"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {t("vehicles.speedLimitHint")}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="initialOdometerKm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("vehicles.initialOdometer")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={9_999_999_999}
                          step={1}
                          inputMode="decimal"
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {t("vehicles.initialOdometerHint")}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("vehicles.notes")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("vehicles.notesPlaceholder")}
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerId"
                  render={() => (
                    <FormItem>
                      <FormLabel>
                        {t("vehicles.customer")}
                        {customerRequired && " *"}
                      </FormLabel>
                      <ResourceSelectCreateRow
                        showCreate={canCreateCompany}
                        createLabel={t("common.createNewCompany")}
                        onCreateClick={() => setCustomerFormOpen(true)}
                        disabled={loadingCustomers}
                      >
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
                                  {customerId && selectedCustomer ? (
                                    <span
                                      style={{
                                        paddingLeft: (selectedCustomer.depth ?? 0) * 12,
                                      }}
                                      className="inline-block"
                                    >
                                      {selectedCustomer.name}
                                    </span>
                                  ) : (
                                    customerPlaceholder
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
                                placeholder={t("vehicles.filterClient")}
                                className="h-9"
                              />
                              <CommandList>
                                <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                                <CommandGroup>
                                  {!customerRequired && (
                                    <CommandItem
                                      value={t("customers.noParent")}
                                      onSelect={() => {
                                        form.setValue("customerId", "", {
                                          shouldValidate: true,
                                        });
                                        setCustomerComboboxOpen(false);
                                      }}
                                    >
                                      {t("customers.noParent")}
                                    </CommandItem>
                                  )}
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
                      </ResourceSelectCreateRow>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Dispositivo */}
              {isEdit ? (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {t("vehicles.device")}
                  </p>
                  <FormField
                    control={form.control}
                    name="trackerDeviceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("vehicles.device")}</FormLabel>
                        <Select
                          value={field.value || "none"}
                          onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                          disabled={loadingDevices}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("vehicles.noDevice")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">{t("vehicles.noDevice")}</SelectItem>
                            {devices.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                <span className="font-mono text-xs">{d.imei}</span>
                                <span className="text-muted-foreground ml-1">
                                  ({d.model}){d.name ? ` · ${d.name}` : ""}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {t("vehicles.deviceAssociation")}
                  </p>

                  <FormField
                    control={form.control}
                    name="deviceOption"
                    render={({ field }) => (
                      <FormItem>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {deviceOption === "existing" && (
                    <FormField
                      control={form.control}
                      name="trackerDeviceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("vehicles.device")}</FormLabel>
                          <Select
                            value={field.value || "none"}
                            onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                            disabled={loadingDevices}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("vehicles.noDevice")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">{t("vehicles.noDevice")}</SelectItem>
                              {devices.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  <span className="font-mono text-xs">{d.imei}</span>
                                  <span className="text-muted-foreground ml-1">
                                    ({d.model}){d.name ? ` · ${d.name}` : ""}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {deviceOption === "new" && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                      <p className="text-sm font-medium">{t("vehicles.sectionDevice")}</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="newImei"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("vehicles.imei")} *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t("vehicles.imeiPlaceholder")}
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
                          name="newDeviceName"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>{t("vehicles.deviceNameOptional")}</FormLabel>
                              <FormControl>
                                <Input placeholder={t("common.name")} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="newEquipmentModel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("vehicles.equipmentModel")}</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: SUNT CH" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="newSerialSat"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("vehicles.serialSat")}</FormLabel>
                              <FormControl>
                                <Input className="font-mono" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="newIndividualPassword"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>{t("vehicles.individualPassword")}</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  autoComplete="off"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <p className="text-sm font-medium pt-2">
                        {t("vehicles.sectionSimData")}
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="newCarrier"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("vehicles.carrier")}</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: SMARTSIM" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="newSimCardNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("vehicles.simCardNumber")}</FormLabel>
                              <FormControl>
                                <Input className="font-mono" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="newCellNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("vehicles.cellNumber")}</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: 16995636896" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
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
        <DrawerStackParentDim show={customerFormOpen} />
      </SheetContent>
    </Sheet>

    <CustomerFormDialog
      open={customerFormOpen}
      onOpenChange={setCustomerFormOpen}
      customer={null}
      organizationId={organizationId}
      customers={customers}
      defaultParentId={
        selectedCustomerId ??
        (customerId?.trim() ? customerId.trim() : null) ??
        undefined
      }
      allowRootCreation={user?.isSuperAdmin === true || currentOrganization?.role?.key === 'ORGANIZATION_OWNER'}
      hideOverlay
      onSuccess={(created) => {
        refreshCustomersList();
        if (created?.id) {
          form.setValue("customerId", created.id, { shouldValidate: true });
        }
      }}
    />
    </>
  );
}

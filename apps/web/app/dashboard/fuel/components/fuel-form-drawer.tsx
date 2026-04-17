"use client";

import { useEffect, useRef, useState } from "react";
import { isBrazilUfSigla } from "@gleandroj/shared";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
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
import { Separator } from "@/components/ui/separator";
import { DateTimePicker } from "@/components/ui/date-picker";
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
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n/useTranslation";
import {
  formatLocaleCurrency,
  formatLocaleDecimal,
  getCurrencyNarrowSymbol,
  i18nLanguageToIntlLocale,
  parseLocalizedDecimalInput,
} from "@/lib/locale-decimal";
import {
  fuelAPI,
  vehiclesAPI,
  driversAPI,
  type FuelLog,
  type FuelType,
  type CreateFuelLogPayload,
  type IbgeEstadoOption,
  type IbgeMunicipioOption,
  type Driver,
} from "@/lib/frontend/api-client";
import { format } from "date-fns";
import { toast } from "sonner";
import { ResourceSelectCreateRow } from "@/components/resource-select-create-row";
import { VehicleFormDialog } from "@/app/dashboard/vehicles/vehicle-form-dialog";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { useAuth } from "@/lib/hooks/use-auth";
import { DrawerStackParentDim } from "@/components/drawer-stack-parent-dim";

const FUEL_TYPES: FuelType[] = ["GASOLINE", "ETHANOL", "DIESEL", "ELECTRIC", "GNV"];

/** Valor do Select quando não há motorista (Radix não aceita `value=""` em SelectItem). */
const DRIVER_NONE = "__none__";

function requiredPositiveNumber(
  t: (k: string) => string,
  emptyKey: string,
  posKey: string,
  max: number,
) {
  return z.preprocess(
    (raw) => {
      if (raw === "" || raw === undefined || raw === null) return undefined;
      if (typeof raw === "number" && (Number.isNaN(raw) || raw === 0)) return undefined;
      return raw;
    },
    z
      .number({
        required_error: t(emptyKey),
        invalid_type_error: t(emptyKey),
      })
      .positive(t(posKey))
      .max(max),
  );
}

interface FuelFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: FuelLog | null;
  organizationId: string;
  onSuccess: () => void;
}

const buildSchema = (t: (k: string) => string) =>
  z.object({
    vehicleId: z.string().min(1, t("fuel.form.vehicleRequired")),
    driverId: z.string(),
    date: z.string().min(1, t("fuel.form.dateRequired")),
    odometer: requiredPositiveNumber(
      t,
      "fuel.form.odometerRequired",
      "fuel.form.odometerPositive",
      9_999_999_999,
    ),
    liters: requiredPositiveNumber(
      t,
      "fuel.form.litersRequired",
      "fuel.form.litersPositive",
      999_999,
    ),
    pricePerLiter: requiredPositiveNumber(
      t,
      "fuel.form.priceRequired",
      "fuel.form.pricePositive",
      9_999_999,
    ),
    fuelType: z.enum(["GASOLINE", "ETHANOL", "DIESEL", "ELECTRIC", "GNV"], {
      required_error: t("fuel.form.fuelTypeRequired"),
    }),
    station: z.string().optional(),
    state: z
      .string()
      .optional()
      .transform((s) => {
        if (!s?.trim()) return undefined;
        return s.trim().toUpperCase();
      })
      .refine((s) => s === undefined || isBrazilUfSigla(s), {
        message: t("fuel.form.stateInvalid"),
      }),
    city: z
      .string()
      .optional()
      .transform((s) => (!s?.trim() ? undefined : s.trim())),
    receipt: z.string().optional(),
    notes: z.string().optional(),
  });

export function FuelFormDrawer({
  open,
  onOpenChange,
  log,
  organizationId,
  onSuccess,
}: FuelFormDrawerProps) {
  const { t, currentLanguage } = useTranslation();
  const { can } = usePermissions();
  const { selectedCustomerId, currentOrganization } = useAuth();
  const intlLocale = i18nLanguageToIntlLocale(currentLanguage);
  const currencyCode = currentOrganization?.currency ?? "BRL";
  const [vehicles, setVehicles] = useState<Array<{ id: string; name?: string; plate?: string }>>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [pricePerLiterInput, setPricePerLiterInput] = useState("");
  const [litersInput, setLitersInput] = useState("");
  const [estados, setEstados] = useState<IbgeEstadoOption[]>([]);
  const [municipios, setMunicipios] = useState<IbgeMunicipioOption[]>([]);
  const [loadingEstados, setLoadingEstados] = useState(false);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [stateComboboxOpen, setStateComboboxOpen] = useState(false);
  const [cityComboboxOpen, setCityComboboxOpen] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const prevStateUfRef = useRef("");

  const isEditing = !!log;

  const schema = buildSchema(t);
  type FormData = {
    vehicleId: string;
    driverId: string;
    date: string;
    odometer: number;
    liters: number;
    pricePerLiter: number;
    fuelType: FuelType;
    station?: string;
    state?: string;
    city?: string;
    receipt?: string;
    notes?: string;
  };

  const form = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      vehicleId: "",
      driverId: DRIVER_NONE,
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      odometer: undefined as unknown as number,
      liters: undefined as unknown as number,
      pricePerLiter: undefined as unknown as number,
      fuelType: "GASOLINE",
      station: "",
      state: "",
      city: "",
      receipt: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    const nextValues = log
      ? {
          vehicleId: log.vehicleId,
          driverId: log.driverId ?? DRIVER_NONE,
          date: log.date,
          odometer: log.odometer,
          liters: log.liters,
          pricePerLiter: log.pricePerLiter,
          fuelType: log.fuelType,
          station: log.station ?? "",
          state: log.state ?? "",
          city: log.city ?? "",
          receipt: log.receipt ?? "",
          notes: log.notes ?? "",
        }
      : {
          vehicleId: "",
          driverId: DRIVER_NONE,
          date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
          odometer: undefined as unknown as number,
          liters: undefined as unknown as number,
          pricePerLiter: undefined as unknown as number,
          fuelType: "GASOLINE" as FuelType,
          station: "",
          state: "",
          city: "",
          receipt: "",
          notes: "",
        };
    form.reset(nextValues);
    prevStateUfRef.current = (nextValues as { state?: string }).state ?? "";
    setLitersInput(
      log && nextValues.liters != null && !Number.isNaN(Number(nextValues.liters))
        ? formatLocaleDecimal(Number(nextValues.liters), intlLocale, {
            maxFractionDigits: 3,
          })
        : "",
    );
    setPricePerLiterInput(
      log && nextValues.pricePerLiter != null && !Number.isNaN(Number(nextValues.pricePerLiter))
        ? formatLocaleDecimal(Number(nextValues.pricePerLiter), intlLocale, {
            maxFractionDigits: 3,
          })
        : "",
    );
  }, [open, log, intlLocale]);

  useEffect(() => {
    if (!organizationId) return;
    setLoadingVehicles(true);
    vehiclesAPI
      .list(organizationId)
      .then((res) => setVehicles(Array.isArray(res.data) ? res.data : []))
      .catch(() => setVehicles([]))
      .finally(() => setLoadingVehicles(false));
  }, [organizationId]);

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoadingDrivers(true);
    driversAPI
      .list(organizationId, selectedCustomerId ? { customerId: selectedCustomerId } : undefined)
      .then((res) => setDrivers(Array.isArray(res.data?.drivers) ? res.data.drivers : []))
      .catch(() => setDrivers([]))
      .finally(() => setLoadingDrivers(false));
  }, [open, organizationId, selectedCustomerId]);

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoadingEstados(true);
    fuelAPI
      .listGeoStates(organizationId)
      .then((r) => setEstados(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEstados([]))
      .finally(() => setLoadingEstados(false));
  }, [open, organizationId]);

  const stateUf = form.watch("state") ?? "";

  useEffect(() => {
    if (!open) return;
    const prev = prevStateUfRef.current;
    if (
      prev &&
      stateUf &&
      prev !== stateUf &&
      isBrazilUfSigla(prev) &&
      isBrazilUfSigla(stateUf)
    ) {
      form.setValue("city", "", { shouldValidate: true });
    }
    prevStateUfRef.current = stateUf || "";
  }, [stateUf, open, form]);

  useEffect(() => {
    if (!open || !organizationId) {
      setMunicipios([]);
      return;
    }
    const uf = (stateUf || "").trim().toUpperCase();
    if (!isBrazilUfSigla(uf)) {
      setMunicipios([]);
      return;
    }
    setLoadingMunicipios(true);
    fuelAPI
      .listGeoMunicipios(organizationId, uf)
      .then((r) => setMunicipios(Array.isArray(r.data) ? r.data : []))
      .catch(() => setMunicipios([]))
      .finally(() => setLoadingMunicipios(false));
  }, [open, organizationId, stateUf]);

  const litersVal = form.watch("liters");
  const priceVal = form.watch("pricePerLiter");
  const totalCost =
    litersVal != null &&
    priceVal != null &&
    !Number.isNaN(litersVal) &&
    !Number.isNaN(priceVal) &&
    litersVal > 0 &&
    priceVal > 0
      ? litersVal * priceVal
      : null;
  const canCreateVehicle = can(Module.VEHICLES, Action.CREATE);

  const refreshVehiclesSilently = () => {
    if (!organizationId) return;
    vehiclesAPI
      .list(organizationId)
      .then((res) => setVehicles(Array.isArray(res.data) ? res.data : []))
      .catch(() => setVehicles([]));
  };

  const handleSubmit = async (data: FormData) => {
    try {
      setSubmitting(true);
      if (isEditing) {
        await fuelAPI.update(organizationId, log.id, {
          driverId: data.driverId === DRIVER_NONE ? null : data.driverId,
          date: data.date,
          odometer: data.odometer,
          liters: data.liters,
          pricePerLiter: data.pricePerLiter,
          fuelType: data.fuelType,
          station: data.station?.trim() || undefined,
          state: data.state,
          city: data.city,
          receipt: data.receipt?.trim() || undefined,
          notes: data.notes?.trim() || undefined,
        });
        toast.success(t("fuel.toastUpdated"));
      } else {
        const payload: CreateFuelLogPayload = {
          vehicleId: data.vehicleId,
          date: data.date,
          odometer: data.odometer,
          liters: data.liters,
          pricePerLiter: data.pricePerLiter,
          fuelType: data.fuelType,
          station: data.station?.trim() || undefined,
          state: data.state,
          city: data.city,
          receipt: data.receipt?.trim() || undefined,
          notes: data.notes?.trim() || undefined,
        };
        if (data.driverId !== DRIVER_NONE) {
          payload.driverId = data.driverId;
        }
        await fuelAPI.create(organizationId, payload);
        toast.success(t("fuel.toastCreated"));
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error(t("fuel.toastError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-[600px]">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>
            {isEditing ? t("fuel.editLog") : t("fuel.newLog")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <Form {...form}>
            <form
              id="fuel-form"
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {/* Veículo */}
              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fuel.fields.vehicle")}</FormLabel>
                    <ResourceSelectCreateRow
                      showCreate={canCreateVehicle}
                      createLabel={t("common.createNewVehicle")}
                      onCreateClick={() => setVehicleFormOpen(true)}
                      disabled={submitting || loadingVehicles}
                    >
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={submitting || loadingVehicles}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("fuel.form.selectVehicle")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vehicles.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name || "N/A"} ({v.plate || "N/A"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ResourceSelectCreateRow>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("fuel.fields.driver")}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({t("common.optional")})
                      </span>
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting || loadingDrivers}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("fuel.form.selectDriver")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={DRIVER_NONE}>{t("fuel.form.noDriver")}</SelectItem>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Data e Odômetro: flex evita colunas que comprimem data+hora contra o hodômetro */}
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="min-w-0 w-full flex-1">
                      <FormLabel>{t("fuel.fields.date")}</FormLabel>
                      <FormControl>
                        <DateTimePicker
                          value={field.value}
                          onChange={field.onChange}
                          disabled={submitting}
                          className="w-full min-w-0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="odometer"
                  render={({ field }) => (
                    <FormItem className="w-full shrink-0 sm:w-44 md:w-48">
                      <FormLabel>{t("fuel.fields.odometer")}</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={10}
                          autoComplete="off"
                          placeholder=""
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          value={
                            field.value === undefined ||
                            field.value === null ||
                            Number.isNaN(field.value)
                              ? ""
                              : String(Math.min(field.value, 9_999_999_999))
                          }
                          onChange={(e) => {
                            const digits = e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 10);
                            if (digits === "") {
                              field.onChange(undefined);
                              return;
                            }
                            field.onChange(parseInt(digits, 10));
                          }}
                          disabled={submitting}
                          className="font-mono tabular-nums"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Tipo de Combustível */}
              <FormField
                control={form.control}
                name="fuelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fuel.fields.fuelType")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={submitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("fuel.form.selectFuelType")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FUEL_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`fuel.fuelTypes.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Litros e Preço por Litro */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="liters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fuel.fields.liters")}</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder=""
                          name={field.name}
                          ref={field.ref}
                          value={litersInput}
                          onChange={(e) => {
                            const next = e.target.value;
                            setLitersInput(next);
                            const n = parseLocalizedDecimalInput(next, intlLocale);
                            field.onChange(
                              n !== null && Number.isFinite(n) && n > 0 ? n : undefined,
                            );
                          }}
                          onBlur={() => {
                            const n = parseLocalizedDecimalInput(litersInput, intlLocale);
                            const clamped =
                              n !== null && Number.isFinite(n) && n > 0
                                ? Math.round(n * 1000) / 1000
                                : undefined;
                            field.onChange(clamped);
                            setLitersInput(
                              clamped === undefined
                                ? ""
                                : formatLocaleDecimal(clamped, intlLocale, {
                                    maxFractionDigits: 3,
                                  }),
                            );
                            field.onBlur();
                          }}
                          disabled={submitting}
                          className="font-mono tabular-nums"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pricePerLiter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fuel.fields.pricePerLiter")}</FormLabel>
                      <FormControl>
                        <div className="flex rounded-md border border-input bg-background shadow-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                          <span className="inline-flex min-w-[2.75rem] shrink-0 items-center justify-center border-r border-input bg-muted/50 px-2 text-sm font-medium text-muted-foreground tabular-nums">
                            {getCurrencyNarrowSymbol(intlLocale, currencyCode)}
                          </span>
                          <Input
                            className="h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent py-2 font-mono tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder={
                              intlLocale.startsWith("pt")
                                ? "0,000"
                                : formatLocaleDecimal(0, intlLocale, {
                                    maxFractionDigits: 3,
                                  })
                            }
                            name={field.name}
                            ref={field.ref}
                            value={pricePerLiterInput}
                            onChange={(e) => {
                              let next = e.target.value;
                              next = next.replace(/[^\d.,\-]/g, "");
                              setPricePerLiterInput(next);
                              const n = parseLocalizedDecimalInput(next, intlLocale);
                              field.onChange(
                                n !== null && Number.isFinite(n) && n > 0 ? n : undefined,
                              );
                            }}
                            onBlur={() => {
                              const n = parseLocalizedDecimalInput(
                                pricePerLiterInput,
                                intlLocale
                              );
                              const clamped =
                                n !== null && Number.isFinite(n) && n > 0
                                  ? Math.round(n * 1000) / 1000
                                  : undefined;
                              field.onChange(clamped);
                              setPricePerLiterInput(
                                clamped === undefined
                                  ? ""
                                  : formatLocaleDecimal(clamped, intlLocale, {
                                      maxFractionDigits: 3,
                                    }),
                              );
                              field.onBlur();
                            }}
                            disabled={submitting}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Total calculado */}
              <div className="rounded-lg border bg-muted/40 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("fuel.fields.totalCost")}
                </span>
                <span className="text-lg font-semibold">
                  {totalCost != null
                    ? formatLocaleCurrency(totalCost, intlLocale, currencyCode)
                    : "—"}
                </span>
              </div>

              <Separator />

              {/* Posto */}
              <FormField
                control={form.control}
                name="station"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fuel.fields.station")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("fuel.form.stationPlaceholder")}
                        {...field}
                        disabled={submitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estado e cidade (IBGE) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("fuel.fields.state")}</FormLabel>
                      <Popover
                        open={stateComboboxOpen}
                        onOpenChange={setStateComboboxOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={stateComboboxOpen}
                              disabled={submitting || loadingEstados}
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <span className="truncate">
                                {field.value && isBrazilUfSigla(field.value)
                                  ? estados.find((e) => e.sigla === field.value)
                                      ? `${field.value} — ${estados.find((e) => e.sigla === field.value)?.nome}`
                                      : field.value
                                  : t("fuel.form.selectState")}
                              </span>
                              {loadingEstados ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-60" />
                              ) : (
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                          align="start"
                        >
                          <Command>
                            <CommandInput
                              placeholder={t("fuel.form.filterState")}
                              className="h-9"
                            />
                            <CommandList>
                              <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="__clear__"
                                  onSelect={() => {
                                    field.onChange("");
                                    form.setValue("city", "", {
                                      shouldValidate: true,
                                    });
                                    setStateComboboxOpen(false);
                                  }}
                                >
                                  {t("fuel.form.clearState")}
                                </CommandItem>
                                {estados.map((e) => (
                                  <CommandItem
                                    key={e.sigla}
                                    value={`${e.sigla} ${e.nome}`}
                                    onSelect={() => {
                                      field.onChange(e.sigla);
                                      setStateComboboxOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === e.sigla
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {e.sigla} — {e.nome}
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
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("fuel.fields.city")}</FormLabel>
                      <Popover
                        open={cityComboboxOpen}
                        onOpenChange={setCityComboboxOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={cityComboboxOpen}
                              disabled={
                                submitting ||
                                !stateUf ||
                                !isBrazilUfSigla(stateUf.trim().toUpperCase()) ||
                                loadingMunicipios
                              }
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <span className="truncate">
                                {field.value ||
                                  (stateUf
                                    ? t("fuel.form.selectCity")
                                    : t("fuel.form.selectStateFirst"))}
                              </span>
                              {loadingMunicipios ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-60" />
                              ) : (
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                          align="start"
                        >
                          <Command>
                            <CommandInput
                              placeholder={t("fuel.form.filterCity")}
                              className="h-9"
                            />
                            <CommandList>
                              <CommandEmpty>
                                {loadingMunicipios
                                  ? t("fuel.form.loadingGeo")
                                  : t("common.noResults")}
                              </CommandEmpty>
                              <CommandGroup>
                                {municipios.map((m) => (
                                  <CommandItem
                                    key={m.id}
                                    value={m.nome}
                                    onSelect={() => {
                                      field.onChange(m.nome);
                                      setCityComboboxOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === m.nome
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {m.nome}
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

              {/* Comprovante (upload S3) */}
              <FormField
                control={form.control}
                name="receipt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fuel.fields.receipt")}</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          ref={receiptFileInputRef}
                          type="file"
                          className="sr-only"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          tabIndex={-1}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            try {
                              setReceiptUploading(true);
                              const { data } = await fuelAPI.uploadReceipt(
                                organizationId,
                                file
                              );
                              field.onChange(data.fileUrl);
                              toast.success(t("fuel.form.receiptUploadOk"));
                            } catch {
                              toast.error(t("fuel.form.receiptUploadError"));
                            } finally {
                              setReceiptUploading(false);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={submitting || receiptUploading}
                          onClick={() => receiptFileInputRef.current?.click()}
                        >
                          {receiptUploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("fuel.form.receiptUploading")}
                            </>
                          ) : field.value ? (
                            t("fuel.form.receiptReplace")
                          ) : (
                            t("fuel.form.receiptSelect")
                          )}
                        </Button>
                        {field.value ? (
                          <>
                            <Button type="button" variant="link" className="px-0 h-auto" asChild>
                              <a
                                href={field.value}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {t("fuel.form.receiptView")}
                              </a>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground"
                              disabled={submitting || receiptUploading}
                              onClick={() => field.onChange("")}
                            >
                              {t("fuel.form.receiptRemove")}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {t("fuel.form.receiptHint")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Observações */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fuel.fields.notes")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("fuel.form.notesPlaceholder")}
                        rows={3}
                        {...field}
                        disabled={submitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="fuel-form"
            disabled={submitting || loadingVehicles}
          >
            {submitting ? t("common.saving") : t("common.save")}
          </Button>
        </SheetFooter>
        <DrawerStackParentDim show={vehicleFormOpen} />
      </SheetContent>
    </Sheet>

    <VehicleFormDialog
      open={vehicleFormOpen}
      onOpenChange={setVehicleFormOpen}
      vehicle={null}
      organizationId={organizationId}
      defaultCustomerId={selectedCustomerId}
      hideOverlay
      onSuccess={(created) => {
        refreshVehiclesSilently();
        if (created?.id) {
          form.setValue("vehicleId", created.id, { shouldValidate: true });
        }
      }}
    />
    </>
  );
}

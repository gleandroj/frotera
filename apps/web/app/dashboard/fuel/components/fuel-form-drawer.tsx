"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { useTranslation } from "@/i18n/useTranslation";
import {
  fuelAPI,
  vehiclesAPI,
  type FuelLog,
  type FuelType,
  type CreateFuelLogPayload,
} from "@/lib/frontend/api-client";
import { format } from "date-fns";
import { toast } from "sonner";
import { ResourceSelectCreateRow } from "@/components/resource-select-create-row";
import { VehicleFormDialog } from "@/app/dashboard/vehicles/vehicle-form-dialog";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { useAuth } from "@/lib/hooks/use-auth";

const FUEL_TYPES: FuelType[] = ["GASOLINE", "ETHANOL", "DIESEL", "ELECTRIC", "GNV"];

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
    date: z.string().min(1, t("fuel.form.dateRequired")),
    odometer: z
      .number({ required_error: t("fuel.form.odometerRequired") })
      .positive(t("fuel.form.odometerPositive")),
    liters: z
      .number({ required_error: t("fuel.form.litersRequired") })
      .positive(t("fuel.form.litersPositive")),
    pricePerLiter: z
      .number({ required_error: t("fuel.form.priceRequired") })
      .positive(t("fuel.form.pricePositive")),
    fuelType: z.enum(["GASOLINE", "ETHANOL", "DIESEL", "ELECTRIC", "GNV"], {
      required_error: t("fuel.form.fuelTypeRequired"),
    }),
    station: z.string().optional(),
    city: z.string().optional(),
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
  const { t } = useTranslation();
  const { can } = usePermissions();
  const { selectedCustomerId } = useAuth();
  const [vehicles, setVehicles] = useState<Array<{ id: string; name?: string; plate?: string }>>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);

  const isEditing = !!log;

  const schema = buildSchema(t);
  type FormData = z.infer<typeof schema>;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleId: "",
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      odometer: 0,
      liters: 0,
      pricePerLiter: 0,
      fuelType: "GASOLINE",
      station: "",
      city: "",
      receipt: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      log
        ? {
            vehicleId: log.vehicleId,
            date: log.date,
            odometer: log.odometer,
            liters: log.liters,
            pricePerLiter: log.pricePerLiter,
            fuelType: log.fuelType,
            station: log.station ?? "",
            city: log.city ?? "",
            receipt: log.receipt ?? "",
            notes: log.notes ?? "",
          }
        : {
            vehicleId: "",
            date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            odometer: 0,
            liters: 0,
            pricePerLiter: 0,
            fuelType: "GASOLINE",
            station: "",
            city: "",
            receipt: "",
            notes: "",
          }
    );
  }, [open, log]);

  useEffect(() => {
    if (!organizationId) return;
    setLoadingVehicles(true);
    vehiclesAPI
      .list(organizationId)
      .then((res) => setVehicles(Array.isArray(res.data) ? res.data : []))
      .catch(() => setVehicles([]))
      .finally(() => setLoadingVehicles(false));
  }, [organizationId]);

  const liters = form.watch("liters") || 0;
  const pricePerLiter = form.watch("pricePerLiter") || 0;
  const totalCost = liters * pricePerLiter;
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
        await fuelAPI.update(organizationId, log.id, data);
        toast.success(t("fuel.toastUpdated"));
      } else {
        await fuelAPI.create(organizationId, data as CreateFuelLogPayload);
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

              <Separator />

              {/* Data e Odômetro */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fuel.fields.date")}</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          disabled={submitting}
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
                    <FormItem>
                      <FormLabel>{t("fuel.fields.odometer")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          disabled={submitting}
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
                          type="number"
                          step="0.001"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          disabled={submitting}
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
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          disabled={submitting}
                        />
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
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(totalCost)}
                </span>
              </div>

              <Separator />

              {/* Posto e Cidade */}
              <div className="grid gap-4 sm:grid-cols-2">
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
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fuel.fields.city")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("fuel.form.cityPlaceholder")}
                          {...field}
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Comprovante */}
              <FormField
                control={form.control}
                name="receipt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fuel.fields.receipt")}</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder={t("fuel.form.receiptPlaceholder")}
                        {...field}
                        disabled={submitting}
                      />
                    </FormControl>
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

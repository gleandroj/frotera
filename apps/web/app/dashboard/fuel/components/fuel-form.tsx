"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useAuth } from "@/lib/hooks/use-auth";
import { vehiclesAPI } from "@/lib/frontend/api-client";
import type {
  FuelLog,
  FuelType,
  CreateFuelLogPayload,
  UpdateFuelLogPayload,
} from "@/lib/frontend/api-client";
import { format } from "date-fns";

const FUEL_TYPES: FuelType[] = ["GASOLINE", "ETHANOL", "DIESEL", "ELECTRIC", "GNV"];

interface FuelFormProps {
  initialValues?: FuelLog;
  onSubmit: (payload: CreateFuelLogPayload | UpdateFuelLogPayload) => void;
  loading?: boolean;
}

export function FuelForm({ initialValues, onSubmit, loading = false }: FuelFormProps) {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const [vehicles, setVehicles] = useState<Array<{ id: string; name?: string; plate?: string }>>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  const schema = z.object({
    vehicleId: z
      .string({ required_error: t("fuel.form.vehicleRequired") })
      .min(1, t("fuel.form.vehicleRequired")),
    date: z
      .string({ required_error: t("fuel.form.dateRequired") })
      .min(1, t("fuel.form.dateRequired")),
    odometer: z
      .number({ required_error: t("fuel.form.odometerRequired") })
      .positive(t("fuel.form.odometerPositive")),
    liters: z
      .number({ required_error: t("fuel.form.litersRequired") })
      .positive(t("fuel.form.litersPositive")),
    pricePerLiter: z
      .number({ required_error: t("fuel.form.priceRequired") })
      .positive(t("fuel.form.pricePositive")),
    fuelType: z.enum(
      ["GASOLINE", "ETHANOL", "DIESEL", "ELECTRIC", "GNV"],
      { required_error: t("fuel.form.fuelTypeRequired") }
    ),
    driverId: z.string().optional(),
    station: z.string().optional(),
    city: z.string().optional(),
    receipt: z.string().optional(),
    notes: z.string().optional(),
  });

  type FormData = z.infer<typeof schema>;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialValues
      ? {
          vehicleId: initialValues.vehicleId,
          date: initialValues.date,
          odometer: initialValues.odometer,
          liters: initialValues.liters,
          pricePerLiter: initialValues.pricePerLiter,
          fuelType: initialValues.fuelType,
          driverId: initialValues.driverId || "",
          station: initialValues.station || "",
          city: initialValues.city || "",
          receipt: initialValues.receipt || "",
          notes: initialValues.notes || "",
        }
      : {
          vehicleId: "",
          date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
          odometer: 0,
          liters: 0,
          pricePerLiter: 0,
          fuelType: "GASOLINE",
          driverId: "",
          station: "",
          city: "",
          receipt: "",
          notes: "",
        },
  });

  const liters = form.watch("liters") || 0;
  const pricePerLiter = form.watch("pricePerLiter") || 0;
  const totalCost = liters * pricePerLiter;

  useEffect(() => {
    if (!currentOrganization?.id) return;
    vehiclesAPI
      .list(currentOrganization.id)
      .then((res) => setVehicles(Array.isArray(res.data) ? res.data : []))
      .catch(() => setVehicles([]))
      .finally(() => setLoadingVehicles(false));
  }, [currentOrganization?.id]);

  const handleSubmit = (data: FormData) => {
    onSubmit({
      ...data,
      odometer: Number(data.odometer),
      liters: Number(data.liters),
      pricePerLiter: Number(data.pricePerLiter),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Veículo */}
        <FormField
          control={form.control}
          name="vehicleId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("fuel.fields.vehicle")}</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={loading || loadingVehicles}
              >
                <FormControl>
                  <SelectTrigger>
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
                  <Input type="datetime-local" {...field} disabled={loading} />
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
                    disabled={loading}
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
                disabled={loading}
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
                    disabled={loading}
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
                    disabled={loading}
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
                    disabled={loading}
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
                    disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={loading || loadingVehicles}>
          {loading ? t("common.saving") : t("common.save")}
        </Button>
      </form>
    </Form>
  );
}

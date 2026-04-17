"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import {
  driversAPI,
  vehiclesAPI,
  type Driver,
} from "@/lib/frontend/api-client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import type { FuelDatePresetKey } from "./fuel-date-range";

const FILTER_ALL = "__all__";

interface FuelFiltersBarProps {
  organizationId: string;
  selectedCustomerId?: string | null;
  filterVehicleId: string;
  filterDriverId: string;
  preset: FuelDatePresetKey;
  customFrom: string;
  customTo: string;
  onVehicleChange: (id: string) => void;
  onDriverChange: (id: string) => void;
  onPresetChange: (p: FuelDatePresetKey) => void;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
}

export function FuelFiltersBar({
  organizationId,
  selectedCustomerId,
  filterVehicleId,
  filterDriverId,
  preset,
  customFrom,
  customTo,
  onVehicleChange,
  onDriverChange,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
}: FuelFiltersBarProps) {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<Array<{ id: string; name?: string | null; plate?: string | null }>>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingV, setLoadingV] = useState(false);
  const [loadingD, setLoadingD] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    setLoadingV(true);
    vehiclesAPI
      .list(organizationId)
      .then((r) => setVehicles(Array.isArray(r.data) ? r.data : []))
      .catch(() => setVehicles([]))
      .finally(() => setLoadingV(false));
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    setLoadingD(true);
    driversAPI
      .list(organizationId, selectedCustomerId ? { customerId: selectedCustomerId } : undefined)
      .then((r) => setDrivers(Array.isArray(r.data?.drivers) ? r.data.drivers : []))
      .catch(() => setDrivers([]))
      .finally(() => setLoadingD(false));
  }, [organizationId, selectedCustomerId]);

  const presets: { key: FuelDatePresetKey; label: string }[] = [
    { key: "today", label: t("fuel.filters.today") },
    { key: "yesterday", label: t("fuel.filters.yesterday") },
    { key: "thisMonth", label: t("fuel.filters.thisMonth") },
    { key: "thisYear", label: t("fuel.filters.thisYear") },
    { key: "custom", label: t("fuel.filters.customRange") },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        {presets.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={preset === key ? "default" : "outline"}
            onClick={() => onPresetChange(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("common.from")}</span>
            <DatePicker value={customFrom} onChange={onCustomFromChange} placeholder={t("common.calendar.pickDate")} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t("common.to")}</span>
            <DatePicker value={customTo} onChange={onCustomToChange} placeholder={t("common.calendar.pickDate")} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t("fuel.filters.vehicle")}</span>
          <Select
            value={filterVehicleId || FILTER_ALL}
            onValueChange={(v) => onVehicleChange(v === FILTER_ALL ? "" : v)}
            disabled={loadingV}
          >
            <SelectTrigger className={cn(loadingV && "opacity-70")}>
              <SelectValue placeholder={t("fuel.filters.allVehicles")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>{t("fuel.filters.allVehicles")}</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name || "—"} ({v.plate || "—"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t("fuel.filters.driver")}</span>
          <Select
            value={filterDriverId || FILTER_ALL}
            onValueChange={(v) => onDriverChange(v === FILTER_ALL ? "" : v)}
            disabled={loadingD}
          >
            <SelectTrigger className={cn(loadingD && "opacity-70")}>
              <SelectValue placeholder={t("fuel.filters.allDrivers")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>{t("fuel.filters.allDrivers")}</SelectItem>
              {drivers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

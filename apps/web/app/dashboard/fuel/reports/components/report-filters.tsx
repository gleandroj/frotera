"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/i18n/useTranslation";
import { Vehicle } from "@/lib/frontend/api-client";
import { X } from "lucide-react";

/** Radix Select não permite SelectItem com value="". */
const ALL_VEHICLES_SELECT_VALUE = "__fuel_report_all_vehicles__";

interface ReportFiltersProps {
  vehicles: Vehicle[];
  selectedVehicleId?: string;
  dateFrom?: string;
  dateTo?: string;
  onVehicleChange?: (vehicleId: string | null) => void;
  onDateFromChange?: (date: string) => void;
  onDateToChange?: (date: string) => void;
}

export function ReportFilters({
  vehicles,
  selectedVehicleId,
  dateFrom,
  dateTo,
  onVehicleChange,
  onDateFromChange,
  onDateToChange,
}: ReportFiltersProps) {
  const { t } = useTranslation();

  const handleClearFilters = () => {
    onVehicleChange?.(null);
    onDateFromChange?.("");
    onDateToChange?.("");
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-end">
      <div className="flex-1 min-w-[200px]">
        <label className="text-sm font-medium">
          {t("navigation.items.vehicles")}
        </label>
        <Select
          value={selectedVehicleId || ALL_VEHICLES_SELECT_VALUE}
          onValueChange={(value) =>
            onVehicleChange?.(
              value === ALL_VEHICLES_SELECT_VALUE ? null : value,
            )
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t("fuel.form.selectVehicle")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VEHICLES_SELECT_VALUE}>
              {t("common.all")}
            </SelectItem>
            {vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicle.name || vehicle.plate || vehicle.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-w-[200px]">
        <label className="text-sm font-medium">{t("common.from")}</label>
        <input
          type="date"
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          value={dateFrom || ""}
          onChange={(e) => onDateFromChange?.(e.target.value)}
        />
      </div>

      <div className="flex-1 min-w-[200px]">
        <label className="text-sm font-medium">{t("common.to")}</label>
        <input
          type="date"
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          value={dateTo || ""}
          onChange={(e) => onDateToChange?.(e.target.value)}
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleClearFilters}
        title={t("common.clear")}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

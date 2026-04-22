"use client";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { CustomerMultiSelect } from "@/components/ui/customer-multi-select";
import { VehicleMultiSelect } from "@/components/ui/vehicle-multi-select";
import { useTranslation } from "@/i18n/useTranslation";
import { X } from "lucide-react";
import { format, subDays, subYears } from "date-fns";

export type DatePreset = "last30d" | "last12m" | "custom";
export type GroupBy = "day" | "month" | "year";

interface FuelReportFiltersProps {
  organizationId: string;
  selectedCustomerIds: string[];
  selectedVehicleIds: string[];
  datePreset: DatePreset;
  dateFrom?: string;
  dateTo?: string;
  groupBy?: GroupBy;
  showGroupBy?: boolean;
  onCustomerIdsChange: (ids: string[]) => void;
  onVehicleIdsChange: (ids: string[]) => void;
  onDatePresetChange: (preset: DatePreset, dateFrom?: string, dateTo?: string) => void;
  onGroupByChange?: (groupBy: GroupBy) => void;
}

export function FuelReportFilters({
  organizationId,
  selectedCustomerIds,
  selectedVehicleIds,
  datePreset,
  dateFrom,
  dateTo,
  groupBy,
  showGroupBy,
  onCustomerIdsChange,
  onVehicleIdsChange,
  onDatePresetChange,
  onGroupByChange,
}: FuelReportFiltersProps) {
  const { t } = useTranslation();

  const handlePreset = (preset: DatePreset) => {
    if (preset === "last30d") {
      const to = format(new Date(), "yyyy-MM-dd");
      const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
      onDatePresetChange("last30d", from, to);
    } else if (preset === "last12m") {
      const to = format(new Date(), "yyyy-MM-dd");
      const from = format(subYears(new Date(), 1), "yyyy-MM-dd");
      onDatePresetChange("last12m", from, to);
    } else {
      onDatePresetChange("custom", dateFrom, dateTo);
    }
  };

  const handleClearAll = () => {
    onCustomerIdsChange([]);
    onVehicleIdsChange([]);
    onDatePresetChange("last30d", ...presetDates("last30d"));
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Date presets */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-md border self-start">
          {(["last30d", "last12m", "custom"] as DatePreset[]).map((p) => (
            <Button
              key={p}
              variant={datePreset === p ? "default" : "ghost"}
              size="sm"
              className="rounded-none first:rounded-l-md last:rounded-r-md"
              onClick={() => handlePreset(p)}
            >
              {t(`fuelReports.filters.${p}`)}
            </Button>
          ))}
        </div>

        {showGroupBy && onGroupByChange && (
          <div className="flex rounded-md border self-start">
            {(["day", "month", "year"] as GroupBy[]).map((g) => (
              <Button
                key={g}
                variant={groupBy === g ? "default" : "ghost"}
                size="sm"
                className="rounded-none first:rounded-l-md last:rounded-r-md"
                onClick={() => onGroupByChange(g)}
              >
                {t(`fuelReports.costs.groupBy.${g}`)}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Custom date range */}
      {datePreset === "custom" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">{t("common.from")}</label>
            <DatePicker
              className="mt-1"
              value={dateFrom}
              onChange={(v) => onDatePresetChange("custom", v, dateTo)}
              placeholder={t("common.calendar.pickDate")}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("common.to")}</label>
            <DatePicker
              className="mt-1"
              value={dateTo}
              onChange={(v) => onDatePresetChange("custom", dateFrom, v)}
              placeholder={t("common.calendar.pickDate")}
            />
          </div>
        </div>
      )}

      {/* Vehicle/Company filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">{t("fuelReports.filters.companies")}</label>
          <div className="mt-1">
            <CustomerMultiSelect
              organizationId={organizationId}
              value={selectedCustomerIds}
              onChange={(ids) => {
                onCustomerIdsChange(ids);
                // Reset vehicles when companies change
                onVehicleIdsChange([]);
              }}
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">{t("fuelReports.filters.vehicles")}</label>
          <div className="mt-1">
            <VehicleMultiSelect
              organizationId={organizationId}
              customerIds={selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined}
              value={selectedVehicleIds}
              onChange={onVehicleIdsChange}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleClearAll} className="gap-1">
          <X className="size-3.5" />
          {t("common.clear")}
        </Button>
      </div>
    </div>
  );
}

function presetDates(preset: "last30d" | "last12m"): [string, string] {
  const to = format(new Date(), "yyyy-MM-dd");
  const from =
    preset === "last30d"
      ? format(subDays(new Date(), 30), "yyyy-MM-dd")
      : format(subYears(new Date(), 1), "yyyy-MM-dd");
  return [from, to];
}

export function defaultDateRange(): { preset: DatePreset; dateFrom: string; dateTo: string } {
  const [from, to] = presetDates("last30d");
  return { preset: "last30d", dateFrom: from, dateTo: to };
}

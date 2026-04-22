"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelReportsAPI, VehicleEfficiency } from "@/lib/frontend/api-client";
import { EfficiencyTable } from "../components/efficiency-table";
import { FuelReportFilters, defaultDateRange, type DatePreset } from "../components/fuel-report-filters";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export default function EfficiencyReportPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();

  const initial = defaultDateRange();
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>(initial.preset);
  const [dateFrom, setDateFrom] = useState(initial.dateFrom);
  const [dateTo, setDateTo] = useState(initial.dateTo);
  const [threshold, setThreshold] = useState(15);
  const [data, setData] = useState<VehicleEfficiency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    fuelReportsAPI
      .efficiency(currentOrganization.id, {
        vehicleIds: selectedVehicleIds.length > 0 ? selectedVehicleIds : undefined,
        customerIds: selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined,
        dateFrom,
        dateTo,
        thresholdPct: threshold,
      })
      .then((res) => setData(res.data))
      .catch(() => toast.error(t("fuel.toastError")))
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, selectedVehicleIds, selectedCustomerIds, dateFrom, dateTo, threshold, t]);

  const handleDatePreset = (preset: DatePreset, from?: string, to?: string) => {
    setDatePreset(preset);
    if (from !== undefined) setDateFrom(from);
    if (to !== undefined) setDateTo(to);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("fuelReports.efficiency.title")}</h1>
        <p className="text-muted-foreground">{t("fuelReports.efficiency.description")}</p>
      </div>

      {currentOrganization && (
        <FuelReportFilters
          organizationId={currentOrganization.id}
          selectedCustomerIds={selectedCustomerIds}
          selectedVehicleIds={selectedVehicleIds}
          datePreset={datePreset}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onCustomerIdsChange={setSelectedCustomerIds}
          onVehicleIdsChange={setSelectedVehicleIds}
          onDatePresetChange={handleDatePreset}
        />
      )}

      <div className="flex items-center gap-4 max-w-xs">
        <Label className="text-sm whitespace-nowrap">
          {t("fuelReports.efficiency.threshold")}: {threshold}%
        </Label>
        <Slider min={5} max={50} step={5} value={[threshold]} onValueChange={([v]) => setThreshold(v)} className="flex-1" />
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">{t("common.loading")}</div>
      ) : data.length === 0 ? (
        <div className="text-center text-muted-foreground">{t("fuelReports.efficiency.noAlerts")}</div>
      ) : (
        <EfficiencyTable data={data} />
      )}
    </div>
  );
}

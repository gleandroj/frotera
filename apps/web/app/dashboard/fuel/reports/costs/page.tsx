"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelReportsAPI, CostsPeriod } from "@/lib/frontend/api-client";
import { CostsBarChart } from "../components/costs-bar-chart";
import { FuelReportFilters, defaultDateRange, type DatePreset, type GroupBy } from "../components/fuel-report-filters";
import { toast } from "sonner";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { formatLocaleCurrency, formatLocaleDecimal } from "@/lib/locale-decimal";
import { formatReportPeriodKey } from "@/lib/format-report-period";

export default function CostsReportPage() {
  const { t } = useTranslation();
  const intlLocale = useIntlLocale();
  const { currentOrganization } = useAuth();

  const initial = defaultDateRange();
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>(initial.preset);
  const [dateFrom, setDateFrom] = useState(initial.dateFrom);
  const [dateTo, setDateTo] = useState(initial.dateTo);
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [data, setData] = useState<CostsPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    fuelReportsAPI
      .costs(currentOrganization.id, {
        vehicleIds: selectedVehicleIds.length > 0 ? selectedVehicleIds : undefined,
        customerIds: selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined,
        dateFrom,
        dateTo,
        groupBy,
      })
      .then((res) => setData(res.data))
      .catch(() => toast.error(t("fuel.toastError")))
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, selectedVehicleIds, selectedCustomerIds, dateFrom, dateTo, groupBy, t]);

  const handleDatePreset = (preset: DatePreset, from?: string, to?: string) => {
    setDatePreset(preset);
    if (from !== undefined) setDateFrom(from);
    if (to !== undefined) setDateTo(to);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("fuelReports.costs.title")}</h1>
        <p className="text-muted-foreground">{t("fuelReports.costs.description")}</p>
      </div>

      {currentOrganization && (
        <FuelReportFilters
          organizationId={currentOrganization.id}
          selectedCustomerIds={selectedCustomerIds}
          selectedVehicleIds={selectedVehicleIds}
          datePreset={datePreset}
          dateFrom={dateFrom}
          dateTo={dateTo}
          groupBy={groupBy}
          showGroupBy
          onCustomerIdsChange={setSelectedCustomerIds}
          onVehicleIdsChange={setSelectedVehicleIds}
          onDatePresetChange={handleDatePreset}
          onGroupByChange={setGroupBy}
        />
      )}

      {loading ? (
        <div className="text-center text-muted-foreground">{t("common.loading")}</div>
      ) : data.length === 0 ? (
        <div className="text-center text-muted-foreground">{t("fuelReports.costs.noData")}</div>
      ) : (
        <>
          <CostsBarChart data={data} intlLocale={intlLocale} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 text-left">{t("fuelReports.summary.period.month")}</th>
                  <th className="py-2 text-right">{t("fuelReports.costs.totalCost")}</th>
                  <th className="py-2 text-right">{t("fuelReports.summary.totalLiters")}</th>
                  <th className="py-2 text-right">{t("fuelReports.costs.avgPrice")}</th>
                  <th className="py-2 text-right">{t("fuelReports.costs.costPerKm")}</th>
                  <th className="py-2 text-right">{t("fuelReports.summary.logsCount")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.period} className="border-b hover:bg-muted/50">
                    <td className="py-2 font-medium">{formatReportPeriodKey(d.period, intlLocale)}</td>
                    <td className="py-2 text-right">{formatLocaleCurrency(d.totalCost, intlLocale, "BRL")}</td>
                    <td className="py-2 text-right">{formatLocaleDecimal(d.totalLiters, intlLocale, { minFractionDigits: 1, maxFractionDigits: 1 })} L</td>
                    <td className="py-2 text-right">
                      {d.avgPricePerLiter !== null ? formatLocaleCurrency(d.avgPricePerLiter, intlLocale, "BRL", { minFractionDigits: 3, maxFractionDigits: 3 }) : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {d.costPerKm !== null ? formatLocaleCurrency(d.costPerKm, intlLocale, "BRL", { minFractionDigits: 4, maxFractionDigits: 4 }) : "—"}
                    </td>
                    <td className="py-2 text-right">{formatLocaleDecimal(d.logsCount, intlLocale, { minFractionDigits: 0, maxFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

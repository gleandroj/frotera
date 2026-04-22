"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelReportsAPI, PeriodSummary } from "@/lib/frontend/api-client";
import { SummaryCards } from "../components/summary-cards";
import { PeriodSelector } from "../components/period-selector";
import { CustomerMultiSelect } from "@/components/ui/customer-multi-select";
import { VehicleMultiSelect } from "@/components/ui/vehicle-multi-select";
import { toast } from "sonner";
import { format } from "date-fns";

type Period = "day" | "month" | "year";

export default function SummaryReportPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useAuth();
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [data, setData] = useState<PeriodSummary | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    fuelReportsAPI
      .summary(currentOrganization.id, {
        period,
        date: format(date, "yyyy-MM-dd"),
        vehicleIds: selectedVehicleIds.length > 0 ? selectedVehicleIds : undefined,
        customerIds: selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined,
      })
      .then((res) => setData(res.data))
      .catch(() => toast.error(t("fuel.toastError")))
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, period, date, selectedVehicleIds, selectedCustomerIds, t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("fuelReports.summary.title")}</h1>
          <p className="text-muted-foreground">{t("fuelReports.summary.description")}</p>
        </div>
        <PeriodSelector period={period} date={date} onPeriodChange={setPeriod} onDateChange={setDate} />
      </div>

      {currentOrganization && (
        <div className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">{t("fuelReports.filters.companies")}</label>
              <div className="mt-1">
                <CustomerMultiSelect
                  organizationId={currentOrganization.id}
                  value={selectedCustomerIds}
                  onChange={(ids) => { setSelectedCustomerIds(ids); setSelectedVehicleIds([]); }}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t("fuelReports.filters.vehicles")}</label>
              <div className="mt-1">
                <VehicleMultiSelect
                  organizationId={currentOrganization.id}
                  customerIds={selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined}
                  value={selectedVehicleIds}
                  onChange={setSelectedVehicleIds}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground">{t("common.loading")}</div>
      ) : !data ? (
        <div className="text-center text-muted-foreground">{t("fuelReports.summary.noData")}</div>
      ) : (
        <SummaryCards data={data} />
      )}
    </div>
  );
}

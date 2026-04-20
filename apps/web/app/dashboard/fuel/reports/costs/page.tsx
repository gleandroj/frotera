"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelReportsAPI, CostsPeriod } from "@/lib/frontend/api-client";
import { CostsBarChart } from "../components/costs-bar-chart";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { formatLocaleCurrency, formatLocaleDecimal } from "@/lib/locale-decimal";
import { formatReportPeriodKey } from "@/lib/format-report-period";

type GroupBy = "day" | "month" | "year";

export default function CostsReportPage() {
  const { t } = useTranslation();
  const intlLocale = useIntlLocale();
  const router = useRouter();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const [data, setData] = useState<CostsPeriod[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    fuelReportsAPI.costs(currentOrganization.id, {
      groupBy,
      ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
    })
      .then((res) => setData(res.data))
      .catch(() => toast.error(t("fuel.toastError")))
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, groupBy, selectedCustomerId, t]);

  const groupByOptions: GroupBy[] = ["day", "month", "year"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/fuel/reports")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("fuel.backToList")}
        </Button>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("fuelReports.costs.title")}</h1>
          <p className="text-muted-foreground">{t("fuelReports.costs.description")}</p>
        </div>
        <div className="flex rounded-md border self-start sm:self-auto">
          {groupByOptions.map((g) => (
            <Button
              key={g}
              variant={groupBy === g ? "default" : "ghost"}
              size="sm"
              className="rounded-none first:rounded-l-md last:rounded-r-md"
              onClick={() => setGroupBy(g)}
            >
              {t(`fuelReports.costs.groupBy.${g}`)}
            </Button>
          ))}
        </div>
      </div>

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
                  <th className="py-2 text-left">Período</th>
                  <th className="py-2 text-right">{t("fuelReports.costs.totalCost")}</th>
                  <th className="py-2 text-right">Litros</th>
                  <th className="py-2 text-right">{t("fuelReports.costs.avgPrice")}</th>
                  <th className="py-2 text-right">{t("fuelReports.costs.costPerKm")}</th>
                  <th className="py-2 text-right">Registros</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.period} className="border-b hover:bg-muted/50">
                    <td className="py-2 font-medium">
                      {formatReportPeriodKey(d.period, intlLocale)}
                    </td>
                    <td className="py-2 text-right">
                      {formatLocaleCurrency(d.totalCost, intlLocale, "BRL")}
                    </td>
                    <td className="py-2 text-right">
                      {formatLocaleDecimal(d.totalLiters, intlLocale, {
                        minFractionDigits: 1,
                        maxFractionDigits: 1,
                      })}{" "}
                      L
                    </td>
                    <td className="py-2 text-right">
                      {d.avgPricePerLiter !== null
                        ? formatLocaleCurrency(d.avgPricePerLiter, intlLocale, "BRL", {
                            minFractionDigits: 3,
                            maxFractionDigits: 3,
                          })
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {d.costPerKm !== null
                        ? formatLocaleCurrency(d.costPerKm, intlLocale, "BRL", {
                            minFractionDigits: 4,
                            maxFractionDigits: 4,
                          })
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {formatLocaleDecimal(d.logsCount, intlLocale, {
                        minFractionDigits: 0,
                        maxFractionDigits: 0,
                      })}
                    </td>
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

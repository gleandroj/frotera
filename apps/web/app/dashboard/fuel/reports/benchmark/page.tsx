"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelReportsAPI, BenchmarkSummary } from "@/lib/frontend/api-client";
import { BenchmarkAreaChart } from "../components/benchmark-area-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { formatLocaleCurrency, formatLocaleDecimal } from "@/lib/locale-decimal";

export default function BenchmarkReportPage() {
  const { t } = useTranslation();
  const intlLocale = useIntlLocale();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const [data, setData] = useState<BenchmarkSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    fuelReportsAPI.benchmark(currentOrganization.id, {
      ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
    })
      .then((res) => setData(res.data))
      .catch(() => toast.error(t("fuel.toastError")))
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, selectedCustomerId, t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("fuelReports.benchmark.title")}</h1>
        <p className="text-muted-foreground">{t("fuelReports.benchmark.description")}</p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">{t("common.loading")}</div>
      ) : !data ? (
        <div className="text-center text-muted-foreground">{t("fuelReports.benchmark.noData")}</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("fuelReports.benchmark.paid")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatLocaleCurrency(data.totalPaid, intlLocale, "BRL")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {data.totalOverpaid !== null && data.totalOverpaid > 0
                    ? t("fuelReports.benchmark.totalOverpaid")
                    : t("fuelReports.benchmark.totalSaved")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.totalOverpaid !== null && data.totalOverpaid > 0 ? "text-red-600" : "text-green-600"}`}>
                  {data.totalOverpaid !== null
                    ? formatLocaleCurrency(Math.abs(data.totalOverpaid), intlLocale, "BRL")
                    : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("fuelReports.benchmark.overpaidPct")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.overpaidPct !== null && data.overpaidPct > 0 ? "text-red-600" : "text-green-600"}`}>
                  {data.overpaidPct !== null
                    ? `${data.overpaidPct > 0 ? "+" : ""}${formatLocaleDecimal(data.overpaidPct, intlLocale, {
                        minFractionDigits: 1,
                        maxFractionDigits: 1,
                      })}%`
                    : "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          {data.timeSeries.length === 0 ? (
            <div className="text-center text-muted-foreground">{t("fuelReports.benchmark.noMarketData")}</div>
          ) : (
            <BenchmarkAreaChart data={data.timeSeries} intlLocale={intlLocale} />
          )}
        </>
      )}
    </div>
  );
}

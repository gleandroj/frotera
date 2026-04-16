"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelReportsAPI, BenchmarkSummary } from "@/lib/frontend/api-client";
import { BenchmarkAreaChart } from "../components/benchmark-area-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function BenchmarkReportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentOrganization } = useAuth();
  const [data, setData] = useState<BenchmarkSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    fuelReportsAPI.benchmark(currentOrganization.id)
      .then((res) => setData(res.data))
      .catch(() => toast.error(t("fuel.toastError")))
      .finally(() => setLoading(false));
  }, [currentOrganization?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/fuel/reports")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("fuel.backToList")}
        </Button>
      </div>
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
                <div className="text-2xl font-bold">{formatCurrency(data.totalPaid)}</div>
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
                  {data.totalOverpaid !== null ? formatCurrency(Math.abs(data.totalOverpaid)) : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("fuelReports.benchmark.overpaidPct")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.overpaidPct !== null && data.overpaidPct > 0 ? "text-red-600" : "text-green-600"}`}>
                  {data.overpaidPct !== null ? `${data.overpaidPct > 0 ? "+" : ""}${data.overpaidPct.toFixed(1)}%` : "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          {data.timeSeries.length === 0 ? (
            <div className="text-center text-muted-foreground">{t("fuelReports.benchmark.noMarketData")}</div>
          ) : (
            <BenchmarkAreaChart data={data.timeSeries} />
          )}
        </>
      )}
    </div>
  );
}

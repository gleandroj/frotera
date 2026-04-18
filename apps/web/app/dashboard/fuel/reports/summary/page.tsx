"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelReportsAPI, PeriodSummary } from "@/lib/frontend/api-client";
import { SummaryCards } from "../components/summary-cards";
import { PeriodSelector } from "../components/period-selector";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";

type Period = "day" | "month" | "year";

export default function SummaryReportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const [data, setData] = useState<PeriodSummary | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    fuelReportsAPI.summary(currentOrganization.id, {
      period,
      date: format(date, "yyyy-MM-dd"),
      ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
    })
      .then((res) => setData(res.data))
      .catch(() => toast.error(t("fuel.toastError")))
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, period, date, selectedCustomerId, t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/fuel/reports")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("fuel.backToList")}
        </Button>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("fuelReports.summary.title")}</h1>
          <p className="text-muted-foreground">{t("fuelReports.summary.description")}</p>
        </div>
        <PeriodSelector
          period={period}
          date={date}
          onPeriodChange={setPeriod}
          onDateChange={setDate}
        />
      </div>

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

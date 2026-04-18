"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/i18n/useTranslation";
import { fuelReportsAPI, VehicleConsumption } from "@/lib/frontend/api-client";
import { ConsumptionChart } from "../components/consumption-chart";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { formatLocaleDecimal } from "@/lib/locale-decimal";

export default function ConsumptionReportPage() {
  const { t } = useTranslation();
  const intlLocale = useIntlLocale();
  const router = useRouter();
  const { currentOrganization } = useAuth();
  const [data, setData] = useState<VehicleConsumption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    fuelReportsAPI.consumption(currentOrganization.id)
      .then((res) => setData(res.data))
      .catch(() => toast.error(t("fuel.toastError")))
      .finally(() => setLoading(false));
  }, [currentOrganization?.id]);

  const trendVariant = (trend: string) => {
    if (trend === "improving") return "secondary";
    if (trend === "worsening") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/fuel/reports")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("fuel.backToList")}
        </Button>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("fuelReports.consumption.title")}</h1>
        <p className="text-muted-foreground">{t("fuelReports.consumption.description")}</p>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">{t("common.loading")}</div>
      ) : data.length === 0 ? (
        <div className="text-center text-muted-foreground">{t("fuelReports.consumption.noData")}</div>
      ) : (
        <>
          <ConsumptionChart data={data} intlLocale={intlLocale} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 text-left">Veículo</th>
                  <th className="py-2 text-right">{t("fuelReports.consumption.avgConsumption")}</th>
                  <th className="py-2 text-right">{t("fuelReports.consumption.best")}</th>
                  <th className="py-2 text-right">{t("fuelReports.consumption.worst")}</th>
                  <th className="py-2 text-right">{t("fuelReports.consumption.totalKm")}</th>
                  <th className="py-2 text-center">{t("fuelReports.consumption.trend")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((v) => (
                  <tr key={v.vehicleId} className="border-b hover:bg-muted/50">
                    <td className="py-2">
                      <div className="font-medium">{v.vehicleName}</div>
                      <div className="text-xs text-muted-foreground">{v.vehiclePlate}</div>
                    </td>
                    <td className="py-2 text-right">
                      {v.avgConsumption != null
                        ? `${formatLocaleDecimal(v.avgConsumption, intlLocale, {
                            minFractionDigits: 2,
                            maxFractionDigits: 2,
                          })} km/l`
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {v.bestConsumption != null
                        ? `${formatLocaleDecimal(v.bestConsumption, intlLocale, {
                            minFractionDigits: 2,
                            maxFractionDigits: 2,
                          })} km/l`
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {v.worstConsumption != null
                        ? `${formatLocaleDecimal(v.worstConsumption, intlLocale, {
                            minFractionDigits: 2,
                            maxFractionDigits: 2,
                          })} km/l`
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {v.totalKm != null
                        ? `${formatLocaleDecimal(v.totalKm, intlLocale, {
                            minFractionDigits: 0,
                            maxFractionDigits: 0,
                          })} km`
                        : "—"}
                    </td>
                    <td className="py-2 text-center">
                      <Badge variant={trendVariant(v.trend)}>
                        {t(`fuelReports.consumption.trends.${v.trend}`)}
                      </Badge>
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

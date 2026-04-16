"use client";
import { PeriodSummary } from "@/lib/frontend/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/i18n/useTranslation";

interface Props { data: PeriodSummary | null }

function ChangeIndicator({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const isPositive = pct > 0;
  return (
    <span className={`text-xs font-medium ${isPositive ? "text-red-500" : "text-green-500"}`}>
      {isPositive ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

export function SummaryCards({ data }: Props) {
  const { t } = useTranslation();

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (!data) return null;

  const cards = [
    {
      title: t("fuelReports.summary.totalCost"),
      value: formatCurrency(data.totalCost),
      change: data.vsLastPeriod.costChangePct,
    },
    {
      title: t("fuelReports.summary.totalLiters"),
      value: `${data.totalLiters.toFixed(1)} L`,
      change: data.vsLastPeriod.litersChangePct,
    },
    {
      title: t("fuelReports.summary.logsCount"),
      value: String(data.logsCount),
      change: null,
    },
    {
      title: t("fuelReports.summary.avgConsumption"),
      value: data.avgConsumption !== null ? `${data.avgConsumption.toFixed(2)} km/l` : "—",
      change: data.vsLastPeriod.consumptionChangePct,
    },
    {
      title: t("fuelReports.summary.avgPricePaid"),
      value: data.avgPricePaid !== null ? `R$ ${data.avgPricePaid.toFixed(3)}` : "—",
      change: null,
    },
    {
      title: t("fuelReports.summary.costPerKm"),
      value: data.costPerKm !== null ? `R$ ${data.costPerKm.toFixed(4)}` : "—",
      change: null,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="flex items-center gap-1 mt-1">
              <ChangeIndicator pct={card.change} />
              {card.change !== null && (
                <span className="text-xs text-muted-foreground">{t("fuelReports.summary.vsLastPeriod")}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

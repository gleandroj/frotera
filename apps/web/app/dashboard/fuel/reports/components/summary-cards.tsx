"use client";
import { PeriodSummary } from "@/lib/frontend/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/i18n/useTranslation";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { formatLocaleCurrency, formatLocaleDecimal } from "@/lib/locale-decimal";

interface Props { data: PeriodSummary | null }

function ChangeIndicator({ pct, locale }: { pct: number | null; locale: string }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const isPositive = pct > 0;
  return (
    <span className={`text-xs font-medium ${isPositive ? "text-red-500" : "text-green-500"}`}>
      {isPositive ? "+" : ""}
      {formatLocaleDecimal(pct, locale, { minFractionDigits: 1, maxFractionDigits: 1 })}%
    </span>
  );
}

export function SummaryCards({ data }: Props) {
  const { t } = useTranslation();
  const intlLocale = useIntlLocale();

  if (!data) return null;

  const cards = [
    {
      title: t("fuelReports.summary.totalCost"),
      value: formatLocaleCurrency(data.totalCost, intlLocale, "BRL"),
      change: data.vsLastPeriod.costChangePct,
    },
    {
      title: t("fuelReports.summary.totalLiters"),
      value: `${formatLocaleDecimal(data.totalLiters, intlLocale, { minFractionDigits: 1, maxFractionDigits: 1 })} L`,
      change: data.vsLastPeriod.litersChangePct,
    },
    {
      title: t("fuelReports.summary.logsCount"),
      value: formatLocaleDecimal(data.logsCount, intlLocale, {
        minFractionDigits: 0,
        maxFractionDigits: 0,
      }),
      change: null,
    },
    {
      title: t("fuelReports.summary.avgConsumption"),
      value:
        data.avgConsumption !== null
          ? `${formatLocaleDecimal(data.avgConsumption, intlLocale, {
              minFractionDigits: 2,
              maxFractionDigits: 2,
            })} km/l`
          : "—",
      change: data.vsLastPeriod.consumptionChangePct,
    },
    {
      title: t("fuelReports.summary.avgPricePaid"),
      value:
        data.avgPricePaid !== null
          ? formatLocaleCurrency(data.avgPricePaid, intlLocale, "BRL", {
              minFractionDigits: 3,
              maxFractionDigits: 3,
            })
          : "—",
      change: null,
    },
    {
      title: t("fuelReports.summary.costPerKm"),
      value:
        data.costPerKm !== null
          ? formatLocaleCurrency(data.costPerKm, intlLocale, "BRL", {
              minFractionDigits: 4,
              maxFractionDigits: 4,
            })
          : "—",
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
              <ChangeIndicator pct={card.change} locale={intlLocale} />
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

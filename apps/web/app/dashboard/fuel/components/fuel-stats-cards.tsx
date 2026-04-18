import { FuelStats } from "@/lib/frontend/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/i18n/useTranslation";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import {
  formatLocaleCurrency,
  formatLocaleDecimal,
} from "@/lib/locale-decimal";

interface FuelStatsCardsProps {
  stats: FuelStats | null;
}

export function FuelStatsCards({ stats }: FuelStatsCardsProps) {
  const { t } = useTranslation();
  const intlLocale = useIntlLocale();

  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('fuel.stats.totalCostMonth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('fuel.stats.avgConsumption')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('fuel.stats.logsMonth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (value: number) =>
    formatLocaleCurrency(value, intlLocale, "BRL");

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('fuel.stats.totalCostMonth')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(stats.totalCost)}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("fuel.stats.refuelsCountSubtitle", {
              count: formatLocaleDecimal(stats.count, intlLocale, {
                minFractionDigits: 0,
                maxFractionDigits: 0,
              }),
            })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('fuel.stats.avgConsumption')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.avgConsumption !== null
              ? `${formatLocaleDecimal(stats.avgConsumption, intlLocale, {
                  minFractionDigits: 2,
                  maxFractionDigits: 2,
                })} km/l`
              : t('fuel.stats.noData')}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('fuel.stats.logsMonth')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatLocaleDecimal(stats.count, intlLocale, {
              minFractionDigits: 0,
              maxFractionDigits: 0,
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("fuel.stats.periodLitersSubtitle", {
              liters: formatLocaleDecimal(stats.totalLiters, intlLocale, {
                minFractionDigits: 2,
                maxFractionDigits: 3,
              }),
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

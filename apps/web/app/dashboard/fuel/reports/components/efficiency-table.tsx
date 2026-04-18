"use client";
import { VehicleEfficiency } from "@/lib/frontend/api-client";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n/useTranslation";
import { useIntlLocale } from "@/lib/hooks/use-intl-locale";
import { formatLocaleCurrency, formatLocaleDecimal } from "@/lib/locale-decimal";

interface Props { data: VehicleEfficiency[] }

export function EfficiencyTable({ data }: Props) {
  const { t } = useTranslation();
  const intlLocale = useIntlLocale();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-2 text-left">Veículo</th>
            <th className="py-2 text-right">{t("fuelReports.efficiency.currentAvg")}</th>
            <th className="py-2 text-right">{t("fuelReports.efficiency.historicalAvg")}</th>
            <th className="py-2 text-right">{t("fuelReports.efficiency.dropPct")}</th>
            <th className="py-2 text-right">{t("fuelReports.efficiency.extraCost")}</th>
            <th className="py-2 text-center">Status</th>
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
                {v.currentAvgConsumption !== null
                  ? `${formatLocaleDecimal(v.currentAvgConsumption, intlLocale, {
                      minFractionDigits: 2,
                      maxFractionDigits: 2,
                    })} km/l`
                  : "—"}
              </td>
              <td className="py-2 text-right">
                {v.historicalAvgConsumption !== null
                  ? `${formatLocaleDecimal(v.historicalAvgConsumption, intlLocale, {
                      minFractionDigits: 2,
                      maxFractionDigits: 2,
                    })} km/l`
                  : "—"}
              </td>
              <td className="py-2 text-right">
                {v.consumptionDropPct !== null ? (
                  <span className={v.isAlert ? "text-red-600 font-medium" : ""}>
                    {formatLocaleDecimal(v.consumptionDropPct, intlLocale, {
                      minFractionDigits: 1,
                      maxFractionDigits: 1,
                    })}
                    %
                  </span>
                ) : "—"}
              </td>
              <td className="py-2 text-right">
                {v.estimatedExtraCost !== null
                  ? formatLocaleCurrency(v.estimatedExtraCost, intlLocale, "BRL")
                  : "—"}
              </td>
              <td className="py-2 text-center">
                <Badge variant={v.isAlert ? "destructive" : "secondary"}>
                  {v.isAlert ? t("fuelReports.efficiency.alert") : t("fuelReports.efficiency.ok")}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

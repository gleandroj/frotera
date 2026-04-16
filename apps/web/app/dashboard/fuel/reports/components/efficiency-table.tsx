"use client";
import { VehicleEfficiency } from "@/lib/frontend/api-client";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n/useTranslation";

interface Props { data: VehicleEfficiency[] }

export function EfficiencyTable({ data }: Props) {
  const { t } = useTranslation();

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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
                {v.currentAvgConsumption !== null ? `${v.currentAvgConsumption.toFixed(2)} km/l` : "—"}
              </td>
              <td className="py-2 text-right">
                {v.historicalAvgConsumption !== null ? `${v.historicalAvgConsumption.toFixed(2)} km/l` : "—"}
              </td>
              <td className="py-2 text-right">
                {v.consumptionDropPct !== null ? (
                  <span className={v.isAlert ? "text-red-600 font-medium" : ""}>
                    {v.consumptionDropPct.toFixed(1)}%
                  </span>
                ) : "—"}
              </td>
              <td className="py-2 text-right">
                {v.estimatedExtraCost !== null ? formatCurrency(v.estimatedExtraCost) : "—"}
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

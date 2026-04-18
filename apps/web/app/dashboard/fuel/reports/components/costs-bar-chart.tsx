"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { CostsPeriod } from "@/lib/frontend/api-client";
import { useTranslation } from "@/i18n/useTranslation";
import { formatReportPeriodKey } from "@/lib/format-report-period";
import { formatLocaleCurrency } from "@/lib/locale-decimal";

interface Props {
  data: CostsPeriod[];
  intlLocale: string;
}

const FUEL_COLORS: Record<string, string> = {
  GASOLINE: "#2563eb",
  ETHANOL: "#16a34a",
  DIESEL: "#d97706",
  ELECTRIC: "#7c3aed",
  GNV: "#0891b2",
};

export function CostsBarChart({ data, intlLocale }: Props) {
  const { t } = useTranslation();
  if (!data.length) return null;

  const fuelTypes = Array.from(
    new Set(data.flatMap((d) => Object.keys(d.byFuelType)))
  );

  const chartData = data.map((d) => ({
    period: d.period,
    ...Object.fromEntries(
      fuelTypes.map((ft) => [ft, d.byFuelType[ft]?.cost ?? 0])
    ),
  }));

  const formatAxisCurrency = (v: number) =>
    new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);

  const formatTooltipCurrency = (v: number) => formatLocaleCurrency(v, intlLocale, "BRL");

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => formatReportPeriodKey(String(v), intlLocale)}
        />
        <YAxis tickFormatter={(v) => formatAxisCurrency(Number(v))} tick={{ fontSize: 12 }} />
        <Tooltip
          labelFormatter={(label) => formatReportPeriodKey(String(label), intlLocale)}
          formatter={(val: number) => formatTooltipCurrency(val)}
        />
        <Legend />
        {fuelTypes.map((ft) => (
          <Bar
            key={ft}
            dataKey={ft}
            name={t(`fuel.fuelTypes.${ft}`, { defaultValue: ft })}
            stackId="a"
            fill={FUEL_COLORS[ft] ?? "#94a3b8"}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

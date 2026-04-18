"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { BenchmarkSummary } from "@/lib/frontend/api-client";
import { formatReportPeriodKey } from "@/lib/format-report-period";
import { formatLocaleCurrency } from "@/lib/locale-decimal";

interface Props {
  data: BenchmarkSummary["timeSeries"];
  intlLocale: string;
}

export function BenchmarkAreaChart({ data, intlLocale }: Props) {
  if (!data.length) return null;

  const chartData = data.map((d) => ({
    date: d.date.slice(0, 10),
    "Preço Pago": d.avgPricePaid,
    "Média Mercado": d.marketAvgPrice,
  }));

  const formatAxis = (v: number) =>
    new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(v);

  const formatTooltip = (val: number) =>
    formatLocaleCurrency(val, intlLocale, "BRL", {
      minFractionDigits: 3,
      maxFractionDigits: 3,
    });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => formatReportPeriodKey(String(v), intlLocale)}
        />
        <YAxis tickFormatter={(v) => formatAxis(Number(v))} tick={{ fontSize: 12 }} />
        <Tooltip
          labelFormatter={(label) => formatReportPeriodKey(String(label), intlLocale)}
          formatter={(val: number) => formatTooltip(val)}
        />
        <Legend />
        <Area type="monotone" dataKey="Preço Pago" stroke="#2563eb" fill="#bfdbfe" />
        <Area type="monotone" dataKey="Média Mercado" stroke="#94a3b8" fill="#e2e8f0" strokeDasharray="5 5" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

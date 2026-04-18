"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { VehicleConsumption } from "@/lib/frontend/api-client";
import { formatReportPeriodKey } from "@/lib/format-report-period";
import { formatLocaleDecimal } from "@/lib/locale-decimal";

interface Props {
  data: VehicleConsumption[];
  intlLocale: string;
}

const COLORS = ["#2563eb","#16a34a","#dc2626","#d97706","#7c3aed","#0891b2"];

export function ConsumptionChart({ data, intlLocale }: Props) {
  if (!data.length) return null;

  // Build flat series: all unique dates, each vehicle as a key
  const dateMap = new Map<string, Record<string, number | null>>();
  data.forEach((v) => {
    v.timeSeries.forEach(({ date, consumption }) => {
      if (!dateMap.has(date)) dateMap.set(date, {});
      dateMap.get(date)![v.vehicleName ?? v.vehicleId] = consumption;
    });
  });
  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date: date.slice(0, 10), ...values }));

  const vehicleNames = data.map((v) => v.vehicleName ?? v.vehicleId);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => formatReportPeriodKey(String(v), intlLocale)}
        />
        <YAxis
          unit=" km/l"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) =>
            formatLocaleDecimal(Number(v), intlLocale, {
              minFractionDigits: 1,
              maxFractionDigits: 2,
            })
          }
        />
        <Tooltip
          labelFormatter={(label) => formatReportPeriodKey(String(label), intlLocale)}
          formatter={(val: number) =>
            `${formatLocaleDecimal(val, intlLocale, {
              minFractionDigits: 2,
              maxFractionDigits: 2,
            })} km/l`
          }
        />
        <Legend />
        {vehicleNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

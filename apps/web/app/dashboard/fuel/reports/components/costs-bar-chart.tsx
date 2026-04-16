"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { CostsPeriod } from "@/lib/frontend/api-client";

interface Props { data: CostsPeriod[] }

const FUEL_COLORS: Record<string, string> = {
  GASOLINE: "#2563eb",
  ETHANOL: "#16a34a",
  DIESEL: "#d97706",
  ELECTRIC: "#7c3aed",
  GNV: "#0891b2",
};

export function CostsBarChart({ data }: Props) {
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

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(val: number) => formatCurrency(val)} />
        <Legend />
        {fuelTypes.map((ft) => (
          <Bar key={ft} dataKey={ft} stackId="a" fill={FUEL_COLORS[ft] ?? "#94a3b8"} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { BenchmarkSummary } from "@/lib/frontend/api-client";

interface Props { data: BenchmarkSummary["timeSeries"] }

export function BenchmarkAreaChart({ data }: Props) {
  if (!data.length) return null;

  const chartData = data.map((d) => ({
    date: d.date.slice(0, 10),
    "Preço Pago": d.avgPricePaid,
    "Média Mercado": d.marketAvgPrice,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(val: number) => `R$ ${val?.toFixed(3)}`} />
        <Legend />
        <Area type="monotone" dataKey="Preço Pago" stroke="#2563eb" fill="#bfdbfe" />
        <Area type="monotone" dataKey="Média Mercado" stroke="#94a3b8" fill="#e2e8f0" strokeDasharray="5 5" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

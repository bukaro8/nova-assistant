"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrencyShort } from "@/lib/currency";

type ChartPoint = {
  label: string;
  total: number;
};

export function WeeklySpendingChart({ data }: { data: ChartPoint[] }) {
  const empty = data.every((point) => point.total === 0);

  if (empty) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No spending recorded this week.
      </div>
    );
  }

  return (
    <div className="h-56">
      <BarChart
        data={data}
        margin={{ left: -20, right: 4, top: 12 }}
        responsive
        style={{ width: "100%", height: "100%" }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <Tooltip
          formatter={(value) => [formatCurrencyShort(Number(value)), "Spent"]}
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </div>
  );
}

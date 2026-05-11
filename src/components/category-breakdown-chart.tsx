"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { formatCurrencyShort } from "@/lib/currency";

type CategoryPoint = {
  category: string;
  total: number;
};

export function CategoryBreakdownChart({
  data,
  currency,
}: {
  data: CategoryPoint[];
  currency?: string | null;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
        No category spending for this period.
      </div>
    );
  }

  return (
    <div className="h-52">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
        responsive
        style={{ width: "100%", height: "100%" }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          dataKey="category"
          type="category"
          tickLine={false}
          axisLine={false}
          width={96}
        />
        <Tooltip
          formatter={(value) => [
            formatCurrencyShort(Number(value), currency),
            "Spent",
          ]}
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar dataKey="total" fill="var(--primary)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </div>
  );
}

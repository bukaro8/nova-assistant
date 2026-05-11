"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type WeightPoint = {
  label: string;
  weight: number;
};

export function WeightTrendChart({ data }: { data: WeightPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
        Add at least two weight logs to see your trend.
      </div>
    );
  }

  return (
    <div className="h-36">
      <LineChart
        data={data}
        margin={{ left: -22, right: 8, top: 16, bottom: 0 }}
        responsive
        style={{ width: "100%", height: "100%" }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis
          dataKey="weight"
          domain={["dataMin - 1", "dataMax + 1"]}
          tickLine={false}
          axisLine={false}
          width={46}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)} kg`, "Weight"]}
          cursor={{ stroke: "var(--muted-foreground)" }}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="var(--primary)"
          strokeWidth={3}
          dot={{ r: 3, fill: "var(--primary)" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </div>
  );
}

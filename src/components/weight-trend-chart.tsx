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
    <div className="h-52 sm:h-56">
      <LineChart
        data={data}
        margin={{ left: -10, right: 10, top: 18, bottom: 4 }}
        responsive
        style={{ width: "100%", height: "100%" }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.55} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          dataKey="weight"
          domain={["dataMin - 0.5", "dataMax + 0.5"]}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)} kg`, "Weight"]}
          cursor={{ stroke: "var(--muted-foreground)" }}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="var(--primary)"
          strokeWidth={4}
          dot={{ r: 3, fill: "var(--background)", strokeWidth: 3 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </div>
  );
}

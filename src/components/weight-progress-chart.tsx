"use client";

import {
  Area,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type WeightProgressPoint = {
  date: string;
  label: string;
  rollingAverage: number | null;
  weight: number;
};

function getDomain(data: WeightProgressPoint[], targetWeight: number | null) {
  const values = data.map((point) => point.weight);

  if (targetWeight !== null) {
    values.push(targetWeight);
  }

  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const padding = Math.max(0.4, (highest - lowest) * 0.16);

  return [
    Math.floor((lowest - padding) * 10) / 10,
    Math.ceil((highest + padding) * 10) / 10,
  ] as const;
}

export function WeightProgressChart({
  data,
  targetWeight,
}: {
  data: WeightProgressPoint[];
  targetWeight: number | null;
}) {
  if (data.length < 2) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border px-5 text-center text-sm text-muted-foreground">
        Add at least two check-ins in this period to see your trend.
      </div>
    );
  }

  const [minimum, maximum] = getDomain(data, targetWeight);

  return (
    <div className="h-72 sm:h-80">
      <LineChart
        data={data}
        margin={{ bottom: 4, left: -10, right: 12, top: 18 }}
        responsive
        style={{ height: "100%", width: "100%" }}
      >
        <defs>
          <linearGradient id="weight-average-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.45} />
        <XAxis
          dataKey="label"
          axisLine={false}
          minTickGap={28}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          domain={[minimum, maximum]}
          tickFormatter={(value) => `${Number(value).toFixed(1)}`}
          tickLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
          formatter={(value, name) => [
            `${Number(value).toFixed(1)} kg`,
            name === "rollingAverage" ? "3-check-in average" : "Weight",
          ]}
          labelFormatter={(_, payload) => payload[0]?.payload.date ?? ""}
        />
        <Legend />
        {targetWeight !== null ? (
          <ReferenceLine
            label={{ fill: "var(--muted-foreground)", fontSize: 12, value: "Goal" }}
            stroke="var(--muted-foreground)"
            strokeDasharray="5 5"
            y={targetWeight}
          />
        ) : null}
        <Area
          dataKey="rollingAverage"
          dot={false}
          fill="url(#weight-average-fill)"
          name="3-check-in average"
          stroke="#f59e0b"
          strokeDasharray="6 4"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          activeDot={{ r: 6 }}
          dataKey="weight"
          dot={{ fill: "var(--background)", r: 3, stroke: "var(--primary)", strokeWidth: 2 }}
          name="Weight"
          stroke="var(--primary)"
          strokeWidth={3}
          type="monotone"
        />
      </LineChart>
    </div>
  );
}

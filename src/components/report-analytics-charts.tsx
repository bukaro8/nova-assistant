"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrencyShort } from "@/lib/currency";

type SpendingIncomePoint = {
  label: string;
  spending: number;
  income: number;
};

type CashDebtPoint = {
  label: string;
  availableMoney: number;
  creditCardDebt: number;
  netPosition: number;
};

type CategoryTrendPoint = {
  label: string;
  groceries: number;
  food: number;
  shopping: number;
  transport: number;
  bills: number;
  subscriptions: number;
  other: number;
};

type AccountSpendingPoint = {
  account: string;
  total: number;
};

type WeightTrendPoint = {
  label: string;
  weight: number;
  rollingAverage: number | null;
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function SpendingIncomeChart({
  currency,
  data,
}: {
  currency?: string | null;
  data: SpendingIncomePoint[];
}) {
  const empty = data.every((point) => point.spending === 0 && point.income === 0);

  if (empty) {
    return <EmptyChart message="No income or spending in this period." />;
  }

  return (
    <div className="h-64">
      <BarChart
        data={data}
        margin={{ bottom: 4, left: -12, right: 8, top: 12 }}
        responsive
        style={{ width: "100%", height: "100%" }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.55} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={56} />
        <Tooltip
          formatter={(value, name) => [
            formatCurrencyShort(Number(value), currency),
            name === "income" ? "Income" : "Spending",
          ]}
          cursor={{ fill: "var(--muted)" }}
        />
        <Legend />
        <Bar
          dataKey="spending"
          fill="var(--destructive)"
          name="Spending"
          radius={[5, 5, 0, 0]}
        />
        <Bar
          dataKey="income"
          fill="var(--primary)"
          name="Income"
          radius={[5, 5, 0, 0]}
        />
      </BarChart>
    </div>
  );
}

export function CashDebtTrendChart({
  currency,
  data,
  showAvailable = true,
  showDebt = true,
  showNet = true,
}: {
  currency?: string | null;
  data: CashDebtPoint[];
  showAvailable?: boolean;
  showDebt?: boolean;
  showNet?: boolean;
}) {
  if (data.length < 2) {
    return <EmptyChart message="Add more account activity to see a trend." />;
  }

  return (
    <div className="h-64">
      <LineChart
        data={data}
        margin={{ bottom: 4, left: -12, right: 12, top: 12 }}
        responsive
        style={{ width: "100%", height: "100%" }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.55} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={56} />
        <Tooltip
          formatter={(value, name) => [
            formatCurrencyShort(Number(value), currency),
            name === "availableMoney"
              ? "Available"
              : name === "creditCardDebt"
                ? "Debt"
                : "Net",
          ]}
          cursor={{ stroke: "var(--muted-foreground)" }}
        />
        <Legend />
        {showAvailable ? (
          <Line
            type="monotone"
            dataKey="availableMoney"
            dot={false}
            name="Available"
            stroke="var(--primary)"
            strokeWidth={3}
          />
        ) : null}
        {showDebt ? (
          <Line
            type="monotone"
            dataKey="creditCardDebt"
            dot={false}
            name="Debt"
            stroke="var(--destructive)"
            strokeWidth={3}
          />
        ) : null}
        {showNet ? (
          <Line
            type="monotone"
            dataKey="netPosition"
            dot={false}
            name="Net"
            stroke="var(--foreground)"
            strokeWidth={3}
          />
        ) : null}
      </LineChart>
    </div>
  );
}

export function CategoryTrendChart({
  currency,
  data,
}: {
  currency?: string | null;
  data: CategoryTrendPoint[];
}) {
  const empty = data.every(
    (point) =>
      point.groceries +
        point.food +
        point.shopping +
        point.transport +
        point.bills +
        point.subscriptions +
        point.other ===
      0,
  );

  if (empty) {
    return <EmptyChart message="No category spending in this period." />;
  }

  return (
    <div className="h-72">
      <BarChart
        data={data}
        margin={{ bottom: 4, left: -12, right: 8, top: 12 }}
        responsive
        style={{ width: "100%", height: "100%" }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.55} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={56} />
        <Tooltip
          formatter={(value, name) => [
            formatCurrencyShort(Number(value), currency),
            String(name),
          ]}
          cursor={{ fill: "var(--muted)" }}
        />
        <Legend />
        <Bar dataKey="groceries" stackId="spend" fill="var(--primary)" name="Groceries" />
        <Bar dataKey="food" stackId="spend" fill="#f59e0b" name="Food" />
        <Bar dataKey="shopping" stackId="spend" fill="#a855f7" name="Shopping" />
        <Bar dataKey="transport" stackId="spend" fill="#06b6d4" name="Transport" />
        <Bar dataKey="bills" stackId="spend" fill="#64748b" name="Bills" />
        <Bar dataKey="subscriptions" stackId="spend" fill="#ec4899" name="Subscriptions" />
        <Bar dataKey="other" stackId="spend" fill="#94a3b8" name="Other" />
      </BarChart>
    </div>
  );
}

export function AccountSpendingChart({
  currency,
  data,
}: {
  currency?: string | null;
  data: AccountSpendingPoint[];
}) {
  if (data.length === 0) {
    return <EmptyChart message="No account spending in this period." />;
  }

  return (
    <div className="h-56">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ bottom: 4, left: 8, right: 8, top: 8 }}
        responsive
        style={{ width: "100%", height: "100%" }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.55} />
        <XAxis type="number" hide />
        <YAxis
          dataKey="account"
          type="category"
          tickLine={false}
          axisLine={false}
          width={96}
        />
        <Tooltip
          formatter={(value) => [
            formatCurrencyShort(Number(value), currency),
            "Spending",
          ]}
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar dataKey="total" fill="var(--primary)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </div>
  );
}

export function WeightReportChart({ data }: { data: WeightTrendPoint[] }) {
  if (data.length < 2) {
    return <EmptyChart message="Add at least two weight logs to see a trend." />;
  }

  return (
    <div className="h-64">
      <LineChart
        data={data}
        margin={{ bottom: 4, left: -10, right: 12, top: 12 }}
        responsive
        style={{ width: "100%", height: "100%" }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.55} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis
          dataKey="weight"
          domain={["dataMin - 0.5", "dataMax + 0.5"]}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value, name) => [
            `${Number(value).toFixed(1)} kg`,
            name === "rollingAverage" ? "Rolling avg" : "Weight",
          ]}
          cursor={{ stroke: "var(--muted-foreground)" }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="weight"
          name="Weight"
          stroke="var(--primary)"
          strokeWidth={3}
        />
        <Line
          type="monotone"
          dataKey="rollingAverage"
          name="Rolling avg"
          stroke="var(--foreground)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </div>
  );
}

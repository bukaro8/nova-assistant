import Link from "next/link";
import { Target } from "lucide-react";

import { AssistantDisabledCard } from "@/components/assistant-disabled-card";
import { WeightProgressChart } from "@/components/weight-progress-chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  deleteWeightLog,
  saveWeight,
  updateWeightGoal,
} from "@/server/dashboard/actions";
import {
  formatShortUkDate,
  formatUkDate,
  getUkClock,
  getUtcForUkDateInput,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import {
  findClosestWeightLog,
  formatWeightChange,
  getGoalProgress,
  getRollingWeightAverage,
} from "@/lib/weight";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

const periodOptions = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "3m", label: "3 months", days: 90 },
  { value: "6m", label: "6 months", days: 180 },
  { value: "1y", label: "1 year", days: 365 },
  { value: "all", label: "All time", days: null },
] as const;

type SearchParams = Promise<{
  period?: string;
}>;

function getPeriod(value: string | undefined) {
  return (
    periodOptions.find((option) => option.value === value) ??
    periodOptions.find((option) => option.value === "30d")!
  );
}

function getPeriodStart(days: number | null) {
  if (days === null) {
    return null;
  }

  const today = getUkClock();
  const midday = new Date(`${today.dateKey}T12:00:00.000Z`);
  const startDateKey = getUkClock(
    new Date(midday.getTime() - (days - 1) * DAY_MS),
  ).dateKey;

  return getUtcForUkDateInput(startDateKey);
}

function formatWeightValue(value: number | null) {
  return value === null ? "No data" : `${value.toFixed(1)} kg`;
}

function formatPeriodDelta(change: number | null) {
  if (change === null) {
    return "Not enough data";
  }

  if (Math.abs(change) < 0.05) {
    return "No change";
  }

  return `${change > 0 ? "+" : "-"}${Math.abs(change).toFixed(1)} kg`;
}

function WeightMetric({
  title,
  description,
  value,
  valueClassName,
}: {
  title: string;
  description: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p
        className={`mt-1 truncate text-xl font-semibold ${valueClassName ?? ""}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export default async function WeightPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireCurrentUser();
  const { period: periodParam } = await searchParams;

  if (!user.assistantWeight) {
    return (
      <AssistantDisabledCard
        title="Weight assistant is disabled"
        description="Enable weight tracking when you want NOVA to track progress and body trends."
      />
    );
  }

  const logs = await prisma.weightLog.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const trendLogs = logs
    .toReversed()
    .map((log) => ({
      weight: Number(log.weight),
      createdAt: log.createdAt,
    }));
  const period = getPeriod(periodParam);
  const periodStart = getPeriodStart(period.days);
  const periodLogs = periodStart
    ? trendLogs.filter((log) => log.createdAt >= periodStart)
    : trendLogs;
  const latest = trendLogs.at(-1) ?? null;
  const earliest = trendLogs.at(0) ?? null;
  const weeklyComparison =
    latest && logs.length > 1
      ? findClosestWeightLog({
          logs: trendLogs.toReversed(),
          latest,
          daysAgo: 7,
          toleranceDays: 3,
        })
      : null;
  const monthlyComparison =
    latest && logs.length > 1
      ? findClosestWeightLog({
          logs: trendLogs.toReversed(),
          latest,
          daysAgo: 30,
          toleranceDays: 7,
        })
      : null;
  const weeklyChange =
    latest && weeklyComparison ? latest.weight - weeklyComparison.weight : null;
  const monthlyChange =
    latest && monthlyComparison
      ? latest.weight - monthlyComparison.weight
      : null;
  const targetWeight = user.targetWeight ? Number(user.targetWeight) : null;
  const chartData = periodLogs.map((log, index) => ({
    date: formatUkDate(log.createdAt),
    label: formatShortUkDate(log.createdAt),
    rollingAverage: getRollingWeightAverage(periodLogs, index),
    weight: log.weight,
  }));
  const periodFirst = periodLogs[0] ?? null;
  const periodLatest = periodLogs.at(-1) ?? null;
  const periodChange =
    periodFirst && periodLatest && periodLogs.length > 1
      ? periodLatest.weight - periodFirst.weight
      : null;
  const periodAverage =
    periodLogs.length > 0
      ? periodLogs.reduce((total, log) => total + log.weight, 0) /
        periodLogs.length
      : null;
  const goalProgress = getGoalProgress({
    startWeight: earliest?.weight ?? null,
    currentWeight: latest?.weight ?? null,
    targetWeight,
  });
  const lowestWeight =
    periodLogs.length > 0
      ? Math.min(...periodLogs.map((log) => log.weight))
      : null;
  const highestWeight =
    periodLogs.length > 0
      ? Math.max(...periodLogs.map((log) => log.weight))
      : null;
  const weeklyText = formatWeightChange(weeklyChange, "this week");
  const monthlyText = formatWeightChange(monthlyChange, "this month");

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Progress tracking</p>
        <h1 className="text-2xl font-semibold tracking-tight">Weight</h1>
      </header>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>Weight trend</CardTitle>
            <CardDescription>
              {period.days === null
                ? "Your complete check-in history."
                : `Showing the last ${period.label.toLowerCase()}.`}
            </CardDescription>
          </div>
          <nav
            aria-label="Weight chart period"
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
          >
            {periodOptions.map((option) => {
              const selected = option.value === period.value;

              return (
                <Link
                  aria-current={selected ? "page" : undefined}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                  href={
                    option.value === "30d"
                      ? "/weight"
                      : `/weight?period=${option.value}`
                  }
                  key={option.value}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>
        </CardHeader>
        <CardContent className="space-y-4">
          <section className="grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border border-border sm:grid-cols-4">
            <WeightMetric
              title="Latest"
              description={
                latest ? formatUkDate(latest.createdAt) : "No logs yet"
              }
              value={formatWeightValue(latest?.weight ?? null)}
            />
            <WeightMetric
              description={
                period.days === null
                  ? "First to latest check-in"
                  : `Across ${period.label.toLowerCase()}`
              }
              title="Change"
              value={formatPeriodDelta(periodChange)}
              valueClassName={
                periodChange === null
                  ? undefined
                  : periodChange <= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
              }
            />
            <WeightMetric
              description={`${periodLogs.length} check-in${
                periodLogs.length === 1 ? "" : "s"
              }`}
              title="Average"
              value={formatWeightValue(periodAverage)}
            />
            <WeightMetric
              description={
                lowestWeight !== null && highestWeight !== null
                  ? `${(highestWeight - lowestWeight).toFixed(1)} kg range`
                  : "No data"
              }
              title="Low"
              value={formatWeightValue(lowestWeight)}
            />
          </section>
          <WeightProgressChart data={chartData} targetWeight={targetWeight} />
          {weeklyText || monthlyText ? (
            <p className="text-sm text-muted-foreground">
              {[weeklyText, monthlyText].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add weight</CardTitle>
          <CardDescription>Date is optional. Empty date uses today.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveWeight} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Weight</span>
                <input
                  className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  inputMode="decimal"
                  name="weight"
                  placeholder="82.5"
                  required
                  type="number"
                  step="0.1"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Date</span>
                <input
                  className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  name="date"
                  type="date"
                />
              </label>
            </div>
            <Button className="h-12 w-full rounded-xl" type="submit">
              Save weight
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Latest logs</h2>
          <p className="text-sm text-muted-foreground">
            Your most recent weight check-ins.
          </p>
        </div>
        {logs.length === 0 ? (
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground">
              No weight logs yet. Add your first check-in above.
            </CardContent>
          </Card>
        ) : (
          logs.map((log) => (
            <Card key={log.id}>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>{Number(log.weight).toFixed(1)} kg</CardTitle>
                  <CardDescription>{formatUkDate(log.createdAt)}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {log.source}
                  </span>
                  <form action={deleteWeightLog}>
                    <input name="logId" type="hidden" value={log.id} />
                    <Button
                      className="h-9 rounded-xl"
                      type="submit"
                      variant="destructive"
                    >
                      Delete
                    </Button>
                  </form>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </section>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5 text-primary" />
              Weight goal
            </CardTitle>
            <CardDescription>Set a target weight for progress tracking.</CardDescription>
          </div>
          {targetWeight ? (
            <div className="rounded-2xl bg-primary/15 px-3 py-2 text-sm font-semibold text-primary">
              {targetWeight.toFixed(1)} kg
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={updateWeightGoal} className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Target weight</span>
              <input
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                inputMode="decimal"
                name="targetWeight"
                placeholder="78.0"
                type="number"
                step="0.1"
                defaultValue={targetWeight?.toFixed(1)}
              />
            </label>
            <Button className="h-12 self-end rounded-xl" type="submit">
              Save goal
            </Button>
          </form>

          {goalProgress && latest && targetWeight ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {goalProgress.reached
                    ? "Goal reached"
                    : `${goalProgress.remaining.toFixed(1)} kg remaining`}
                </span>
                <span className="font-medium">
                  {Math.round(goalProgress.progress)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${goalProgress.progress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Current: {latest.weight.toFixed(1)} kg · Target:{" "}
                {targetWeight.toFixed(1)} kg
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              Add a target and at least one weight log to see goal progress.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

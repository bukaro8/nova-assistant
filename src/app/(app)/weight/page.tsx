import { Target } from "lucide-react";

import { WeightTrendChart } from "@/components/weight-trend-chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  saveWeight,
  updateWeightGoal,
} from "@/server/dashboard/actions";
import {
  formatShortUkDate,
  formatUkDate,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import {
  findClosestWeightLog,
  formatWeightChange,
  getGoalProgress,
} from "@/lib/weight";

export const dynamic = "force-dynamic";

function StatCard({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-3xl font-semibold">{value}</CardContent>
    </Card>
  );
}

export default async function WeightPage() {
  const user = await requireCurrentUser();
  const logs = await prisma.weightLog.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
  });
  const trendLogs = logs
    .toReversed()
    .map((log) => ({
      weight: Number(log.weight),
      createdAt: log.createdAt,
    }));
  const chartData = trendLogs.map((log) => ({
    label: formatShortUkDate(log.createdAt),
    weight: log.weight,
  }));
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
  const goalProgress = getGoalProgress({
    startWeight: earliest?.weight ?? null,
    currentWeight: latest?.weight ?? null,
    targetWeight,
  });
  const lowestWeight =
    trendLogs.length > 0
      ? Math.min(...trendLogs.map((log) => log.weight))
      : null;
  const highestWeight =
    trendLogs.length > 0
      ? Math.max(...trendLogs.map((log) => log.weight))
      : null;
  const weeklyText = formatWeightChange(weeklyChange, "this week");
  const monthlyText = formatWeightChange(monthlyChange, "this month");

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Progress tracking</p>
        <h1 className="text-2xl font-semibold tracking-tight">Weight</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Latest"
          description={latest ? formatUkDate(latest.createdAt) : "No logs yet"}
          value={latest ? `${latest.weight.toFixed(1)} kg` : "No data"}
        />
        <StatCard
          title="Weekly change"
          description="Compared with last week"
          value={weeklyText ?? "Not enough data"}
        />
        <StatCard
          title="Monthly change"
          description="Compared with last month"
          value={monthlyText ?? "Not enough data"}
        />
        <StatCard
          title="Lowest"
          description="Recorded weight"
          value={lowestWeight ? `${lowestWeight.toFixed(1)} kg` : "No data"}
        />
        <StatCard
          title="Highest"
          description="Recorded weight"
          value={highestWeight ? `${highestWeight.toFixed(1)} kg` : "No data"}
        />
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

      <Card>
        <CardHeader>
          <CardTitle>Trend</CardTitle>
          <CardDescription>
            {weeklyText ?? "Add more logs to compare this week."}
            {monthlyText ? ` · ${monthlyText}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WeightTrendChart data={chartData} />
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

      {logs.length === 0 ? (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            No weight logs yet. Add your first check-in above.
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Latest logs</h2>
            <p className="text-sm text-muted-foreground">
              Your most recent weight check-ins.
            </p>
          </div>
          {logs.map((log) => (
            <Card key={log.id}>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>{Number(log.weight).toFixed(1)} kg</CardTitle>
                  <CardDescription>{formatUkDate(log.createdAt)}</CardDescription>
                </div>
                <span className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {log.source}
                </span>
              </CardHeader>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import {
  ArrowUpRight,
  Dumbbell,
  Plus,
  ReceiptText,
  Scale,
  Sparkles,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HabitToast } from "@/components/habit-manage-controls";
import { NovaBrand } from "@/components/nova-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { WeeklySpendingChart } from "@/components/weekly-spending-chart";
import { WeightTrendChart } from "@/components/weight-trend-chart";
import { toggleHabitDone } from "@/server/dashboard/actions";
import {
  getHabitColourOption,
  getHabitIconOption,
} from "@/lib/habits";
import { formatCurrency } from "@/lib/currency";
import {
  formatUkDate,
  formatShortUkDate,
  getCurrentUkWeekRange,
  getUkClock,
  getUkDayRange,
  getWeekChartDays,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const WEIGHT_COMPARISON_WINDOW_MS = 3 * DAY_MS;

function categoryLabel(category: string | null) {
  if (!category) {
    return "Uncategorised";
  }

  return category.charAt(0) + category.slice(1).toLowerCase();
}

function getGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getWeekStrip(start: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    const clock = getUkClock(new Date(date.getTime() + 12 * 60 * 60 * 1000));

    return {
      day: new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        weekday: "short",
      }).format(date),
      dayCode: clock.dayCode,
      date: clock.dateKey.slice(-2),
      dateKey: clock.dateKey,
      active: clock.dateKey === getUkClock().dateKey,
    };
  });
}

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const today = getUkDayRange();
  const week = getCurrentUkWeekRange();
  const clock = getUkClock();

  const [todaysHabits, weekHabits, completedLogs, weeklyHabitLogs, weekExpenses, weightLogs] =
    await Promise.all([
      prisma.habit.findMany({
        where: {
          userId: user.id,
          active: true,
          scheduleDays: {
            has: clock.dayCode,
          },
        },
      }),
      prisma.habit.findMany({
        where: {
          userId: user.id,
          active: true,
        },
        orderBy: {
          reminderTime: "asc",
        },
      }),
      prisma.habitLog.findMany({
        where: {
          userId: user.id,
          status: "DONE",
          loggedAt: {
            gte: today.start,
            lt: today.end,
          },
        },
      }),
      prisma.habitLog.findMany({
        where: {
          userId: user.id,
          status: "DONE",
          loggedAt: {
            gte: week.start,
            lt: week.end,
          },
        },
      }),
      prisma.expense.findMany({
        where: {
          userId: user.id,
          expenseDate: {
            gte: week.start,
            lt: week.end,
          },
        },
        orderBy: {
          expenseDate: "asc",
        },
      }),
      prisma.weightLog.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 14,
      }),
    ]);

  const completedToday = new Set(completedLogs.map((log) => log.habitId));
  const habitTotal = todaysHabits.length;
  const doneTotal = completedToday.size;
  const score = habitTotal === 0 ? 0 : Math.round((doneTotal / habitTotal) * 100);
  const positiveExpenses = weekExpenses.filter(
    (expense) => Number(expense.amount) > 0,
  );
  const weekTotal = positiveExpenses.reduce(
    (total, expense) => total + Number(expense.amount),
    0,
  );
  const categoryTotals = new Map<string, number>();

  for (const expense of positiveExpenses) {
    const category = categoryLabel(expense.category);
    categoryTotals.set(
      category,
      (categoryTotals.get(category) ?? 0) + Number(expense.amount),
    );
  }

  const biggestCategory = Array.from(categoryTotals.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const chartData = getWeekChartDays(week.start);
  const weekStrip = getWeekStrip(week.start);
  const weightTrendData = weightLogs
    .toReversed()
    .map((log) => ({
      label: formatShortUkDate(log.createdAt),
      weight: Number(log.weight),
    }));
  const latestWeight = weightTrendData.at(-1);
  const latestWeightLog = weightLogs[0];
  const targetWeightComparisonTime = latestWeightLog
    ? latestWeightLog.createdAt.getTime() - WEEK_MS
    : null;
  const closestLastWeekWeightLog =
    latestWeightLog && targetWeightComparisonTime !== null
      ? weightLogs.slice(1).reduce<(typeof weightLogs)[number] | null>(
          (closest, log) => {
            const currentDistance = Math.abs(
              log.createdAt.getTime() - targetWeightComparisonTime,
            );

            if (currentDistance > WEIGHT_COMPARISON_WINDOW_MS) {
              return closest;
            }

            if (!closest) {
              return log;
            }

            const closestDistance = Math.abs(
              closest.createdAt.getTime() - targetWeightComparisonTime,
            );

            return currentDistance < closestDistance ? log : closest;
          },
          null,
        )
      : null;
  const weeklyWeightChange =
    latestWeightLog && closestLastWeekWeightLog
      ? Number(latestWeightLog.weight) - Number(closestLastWeekWeightLog.weight)
      : null;
  const weeklyWeightChangeLabel =
    weeklyWeightChange === null
      ? null
      : Math.abs(weeklyWeightChange) < 0.05
        ? "No change"
        : `${weeklyWeightChange > 0 ? "+" : ""}${weeklyWeightChange.toFixed(
            1,
          )} kg vs last week`;
  const weeklyDoneKeys = new Set(
    weeklyHabitLogs.map(
      (log) => `${log.habitId}:${getUkClock(log.loggedAt).dateKey}`,
    ),
  );

  for (const expense of positiveExpenses) {
    const key = getUkClock(expense.expenseDate).dateKey;
    const point = chartData.find((day) => day.key === key);

    if (point) {
      point.total += Number(expense.amount);
    }
  }

  return (
    <div className="space-y-5">
      <HabitToast />
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <NovaBrand className="mb-3" />
          <p className="text-sm text-muted-foreground">{getGreeting()}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {user.name ?? "Victor"}
          </h1>
        </div>
        <ThemeToggle />
      </header>

      <section className="grid grid-cols-7 gap-2">
        {weekStrip.map((day) => (
          <div
            key={`${day.day}-${day.date}`}
            className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border text-center shadow-sm ${
              day.active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card/70 text-muted-foreground"
            }`}
          >
            <span className="text-[0.7rem] font-medium uppercase">
              {day.day}
            </span>
            <span className="text-lg font-semibold">{day.date}</span>
          </div>
        ))}
      </section>

      <Card className="overflow-hidden border-primary/20 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_34%,transparent),color-mix(in_oklch,var(--accent)_22%,transparent)_55%,var(--card))]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/25 px-3 py-1 text-xs font-medium">
                <Sparkles className="size-4" />
                Daily score
              </div>
              <div>
                <div className="text-5xl font-semibold tracking-tight">
                  {score}%
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {doneTotal} of {habitTotal} habits completed today
                </p>
              </div>
            </div>
            <div className="grid size-24 place-items-center rounded-full border border-primary/35 bg-background/25 text-2xl font-semibold shadow-inner">
              {doneTotal}/{habitTotal}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Weekly habits</CardTitle>
            <CardDescription>Monday to Sunday</CardDescription>
          </div>
          <Dumbbell className="size-6 text-primary" />
        </CardHeader>
        <CardContent className="space-y-3">
          {weekHabits.map((habit) => {
            const scheduledDays = weekStrip.filter((day) =>
              habit.scheduleDays.includes(day.dayCode),
            );
            const completeCount = scheduledDays.filter((day) =>
              weeklyDoneKeys.has(`${habit.id}:${day.dateKey}`),
            ).length;
            const Icon = getHabitIconOption(habit.icon).icon;
            const colour = getHabitColourOption(habit.colour);
            const scheduledToday = habit.scheduleDays.includes(clock.dayCode);
            const completed = completedToday.has(habit.id);
            const action = toggleHabitDone.bind(null, habit.id, "/dashboard");

            return (
              <div
                key={habit.id}
                className="rounded-3xl border border-border bg-background/25 p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`grid size-11 shrink-0 place-items-center rounded-2xl ${colour.icon}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate font-medium">{habit.name}</div>
                      <div className="text-sm font-semibold">
                        {completeCount}/{scheduledDays.length}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-1.5">
                      {weekStrip.map((day) => {
                        const scheduled = habit.scheduleDays.includes(day.dayCode);
                        const done = weeklyDoneKeys.has(`${habit.id}:${day.dateKey}`);

                        return (
                          <div
                            key={`${habit.id}-${day.dateKey}`}
                            className={`h-2 rounded-full ${
                              done
                                ? colour.progress
                                : scheduled
                                  ? "bg-muted"
                                  : "bg-transparent"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Current streak: Soon
                    </div>
                    {scheduledToday ? (
                      <form action={action} className="mt-3">
                        <Button
                          className="h-10 w-full rounded-2xl"
                          type="submit"
                          variant={completed ? "outline" : "default"}
                        >
                          {completed ? "Undo" : "Mark done"}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>
              Week of {formatShortUkDate(week.start)}
            </CardDescription>
          </div>
          <ReceiptText className="size-6 text-primary" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-4xl font-semibold tracking-tight">
                {formatCurrency(weekTotal, user.currency)}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {biggestCategory
                  ? `Biggest category: ${biggestCategory[0]}`
                  : "No spending recorded this week."}
              </p>
            </div>
            {biggestCategory ? (
              <div className="rounded-2xl bg-primary/15 px-3 py-2 text-sm font-semibold text-primary">
                {formatCurrency(biggestCategory[1], user.currency)}
              </div>
            ) : null}
          </div>
          <WeeklySpendingChart data={chartData} currency={user.currency} />
          <Link
            href="/expenses"
            className="flex h-11 items-center justify-center rounded-2xl border border-border bg-background text-sm font-medium transition-colors hover:bg-muted"
          >
            View expenses
            <ArrowUpRight className="ml-2 size-4" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Weight</CardTitle>
            <CardDescription>Latest check-in</CardDescription>
          </div>
          <Scale className="size-6 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-4xl font-semibold tracking-tight">
                {latestWeight ? `${latestWeight.weight.toFixed(1)} kg` : "No data"}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {latestWeight
                  ? `Latest log: ${formatUkDate(weightLogs[0].createdAt)}`
                  : "No weight logs recorded yet."}
              </p>
            </div>
            {weeklyWeightChangeLabel ? (
              <div
                className={`rounded-2xl px-3 py-2 text-sm font-semibold ${
                  weeklyWeightChange !== null && weeklyWeightChange <= 0
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-orange-400/15 text-orange-300"
                }`}
              >
                {weeklyWeightChangeLabel}
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <WeightTrendChart data={weightTrendData} />
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/habits"
          className="flex min-h-24 flex-col justify-between rounded-3xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur transition-colors hover:bg-muted"
        >
          <Dumbbell className="size-6 text-primary" />
          <span className="flex items-center justify-between text-sm font-medium">
            Habits
            <ArrowUpRight className="size-4" />
          </span>
        </Link>
        <Link
          href="/weight"
          className="flex min-h-24 flex-col justify-between rounded-3xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur transition-colors hover:bg-muted"
        >
          <Plus className="size-6 text-primary" />
          <span className="flex items-center justify-between text-sm font-medium">
            Add weight
            <ArrowUpRight className="size-4" />
          </span>
        </Link>
      </section>
    </div>
  );
}

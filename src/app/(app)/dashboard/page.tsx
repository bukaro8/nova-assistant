import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  BarChart3,
  Dumbbell,
  Eye,
  FileText,
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
import {
  formatStreak,
  formatWeeklyProgress,
  getHabitStats,
} from "@/lib/habit-stats";
import { formatCurrency } from "@/lib/currency";
import { formatImportantDocumentType } from "@/lib/documents";
import { ExpenseCategory } from "@/generated/prisma/enums";
import {
  findClosestWeightLog,
  formatWeightChange,
  getGoalProgress,
} from "@/lib/weight";
import {
  formatShortUkDate,
  getCurrentUkWeekRange,
  getUkClock,
  getUkDayRange,
  getWeekChartDays,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { getImportantDocumentImageSrc } from "@/server/documents/images";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

function categoryLabel(category: string | null) {
  if (!category) {
    return "Uncategorised";
  }

  return category.charAt(0) + category.slice(1).toLowerCase();
}

function isSpendingExpense(expense: {
  amount: unknown;
  category: string | null;
}) {
  return (
    Number(expense.amount) > 0 &&
    expense.category !== ExpenseCategory.INCOME &&
    expense.category !== ExpenseCategory.TRANSFER
  );
}

function incomeAmount(expense: {
  amount: unknown;
  category: string | null;
}) {
  const amount = Number(expense.amount);

  if (expense.category === ExpenseCategory.INCOME) {
    return Math.abs(amount);
  }

  if (amount < 0 && expense.category !== ExpenseCategory.TRANSFER) {
    return Math.abs(amount);
  }

  return 0;
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

  const [
    todaysHabits,
    weekHabits,
    completedLogs,
    weeklyHabitLogs,
    habitStatsLogs,
    weekExpenses,
    weightLogs,
    importantDocuments,
  ] =
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
      prisma.habitLog.findMany({
        where: {
          userId: user.id,
          status: "DONE",
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
        take: 30,
      }),
      prisma.importantDocument.findMany({
        where: {
          userId: user.id,
        },
        select: {
          id: true,
          title: true,
          type: true,
          expiryDate: true,
          provider: true,
          storageKey: true,
          thumbnailUrl: true,
        },
        orderBy: [
          {
            expiryDate: {
              sort: "asc",
              nulls: "last",
            },
          },
          {
            createdAt: "desc",
          },
        ],
        take: 6,
      }),
    ]);

  const completedToday = new Set(completedLogs.map((log) => log.habitId));
  const habitTotal = todaysHabits.length;
  const doneTotal = completedToday.size;
  const score = habitTotal === 0 ? 0 : Math.round((doneTotal / habitTotal) * 100);
  const spendingExpenses = weekExpenses.filter(isSpendingExpense);
  const weekSpending = spendingExpenses.reduce(
    (total, expense) => total + Number(expense.amount),
    0,
  );
  const weekIncome = weekExpenses.reduce(
    (total, expense) => total + incomeAmount(expense),
    0,
  );
  const weekNet = weekIncome - weekSpending;
  const categoryTotals = new Map<string, number>();

  for (const expense of spendingExpenses) {
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
  const trendLogs = weightLogs
    .toReversed()
    .map((log) => ({
      weight: Number(log.weight),
      createdAt: log.createdAt,
    }));
  const weightTrendData = trendLogs.map((log) => ({
    label: formatShortUkDate(log.createdAt),
    weight: log.weight,
  }));
  const latestWeight = trendLogs.at(-1) ?? null;
  const earliestWeight = trendLogs.at(0) ?? null;
  const closestLastWeekWeightLog =
    latestWeight && trendLogs.length > 1
      ? findClosestWeightLog({
          logs: trendLogs.toReversed(),
          latest: latestWeight,
          daysAgo: 7,
          toleranceDays: 3,
        })
      : null;
  const weeklyWeightChange =
    latestWeight && closestLastWeekWeightLog
      ? latestWeight.weight - closestLastWeekWeightLog.weight
      : null;
  const weeklyWeightChangeLabel = formatWeightChange(
    weeklyWeightChange,
    "this week",
  );
  const targetWeight = user.targetWeight ? Number(user.targetWeight) : null;
  const goalProgress = getGoalProgress({
    startWeight: earliestWeight?.weight ?? null,
    currentWeight: latestWeight?.weight ?? null,
    targetWeight,
  });
  const weeklyDoneKeys = new Set(
    weeklyHabitLogs.map(
      (log) => `${log.habitId}:${getUkClock(log.loggedAt).dateKey}`,
    ),
  );
  const weekStatDays = weekStrip.map((day) => ({
    dateKey: day.dateKey,
    dayCode: day.dayCode,
  }));
  const habitStats = weekHabits.map((habit) =>
    getHabitStats({
      habit,
      logs: habitStatsLogs,
      weekDays: weekStatDays,
      todayDateKey: today.dateKey,
    }),
  );
  const weeklyCompletionTotal = habitStats.reduce(
    (total, stats) => total + stats.weeklyTotal,
    0,
  );
  const weeklyCompletionDone = habitStats.reduce(
    (total, stats) => total + stats.weeklyCompletedCount,
    0,
  );
  const weeklyCompletionPercent =
    weeklyCompletionTotal === 0
      ? 0
      : Math.round((weeklyCompletionDone / weeklyCompletionTotal) * 100);
  const bestCurrentStreak = Math.max(
    0,
    ...habitStats.map((stats) => stats.currentStreak),
  );

  for (const expense of spendingExpenses) {
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

      {user.assistantHabits ? (
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
                    {doneTotal} complete · {Math.max(0, habitTotal - doneTotal)} pending today
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {weeklyCompletionPercent}% weekly consistency · Best streak{" "}
                    {bestCurrentStreak > 0
                      ? `${bestCurrentStreak} days`
                      : "No streak yet"}
                  </p>
                </div>
              </div>
              <div className="grid size-24 place-items-center rounded-full border border-primary/35 bg-background/25 text-2xl font-semibold shadow-inner">
                {doneTotal}/{habitTotal}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {user.assistantHabits ? (
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
              const Icon = getHabitIconOption(habit.icon).icon;
              const colour = getHabitColourOption(habit.colour);
              const scheduledToday = habit.scheduleDays.includes(clock.dayCode);
              const completed = completedToday.has(habit.id);
              const action = toggleHabitDone.bind(null, habit.id, "/dashboard");
              const stats = getHabitStats({
                habit,
                logs: habitStatsLogs,
                weekDays: weekStatDays,
                todayDateKey: today.dateKey,
              });

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
                          {formatWeeklyProgress(
                            stats.weeklyCompletedCount,
                            stats.weeklyTotal,
                          )}
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
                        {formatStreak(stats.currentStreak)} · Longest{" "}
                        {stats.longestStreak > 0
                          ? `${stats.longestStreak} days`
                          : "Start today"}
                      </div>
                      {stats.perfectWeekSoFar ? (
                        <div className="mt-2 text-xs font-medium text-primary">
                          Perfect week so far
                        </div>
                      ) : null}
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
      ) : null}

      {user.assistantExpenses ? (
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
                  {formatCurrency(weekSpending, user.currency)}
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
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background/40 p-3">
                <div className="text-xs text-muted-foreground">
                  Income this period
                </div>
                <div className="mt-1 font-semibold">
                  {formatCurrency(weekIncome, user.currency)}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background/40 p-3">
                <div className="text-xs text-muted-foreground">
                  Spending this period
                </div>
                <div className="mt-1 font-semibold">
                  {formatCurrency(weekSpending, user.currency)}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background/40 p-3">
                <div className="text-xs text-muted-foreground">
                  Net position
                </div>
                <div className="mt-1 font-semibold">
                  {formatCurrency(weekNet, user.currency)}
                </div>
              </div>
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
      ) : null}

      {user.assistantWeight ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Weight</CardTitle>
              <CardDescription>Current progress</CardDescription>
            </div>
            <Scale className="size-6 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-4xl font-semibold tracking-tight">
                  {latestWeight ? `${latestWeight.weight.toFixed(1)} kg` : "No data"}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {weeklyWeightChangeLabel ??
                    "Add more logs to see your weekly trend."}
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
            {goalProgress && targetWeight ? (
              <div className="space-y-2 rounded-2xl border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {goalProgress.reached
                      ? "Goal reached"
                      : `${goalProgress.remaining.toFixed(1)} kg to goal`}
                  </span>
                  <span className="font-medium">
                    {Math.round(goalProgress.progress)}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${goalProgress.progress}%` }}
                  />
                </div>
              </div>
            ) : null}
            <WeightTrendChart data={weightTrendData} />
            <Link
              href="/weight"
              className="flex h-11 items-center justify-center rounded-2xl border border-border bg-background text-sm font-medium transition-colors hover:bg-muted"
            >
              View weight
              <ArrowUpRight className="ml-2 size-4" />
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {!user.assistantHabits &&
      !user.assistantWeight &&
      !user.assistantExpenses ? (
        <Card>
          <CardHeader>
            <CardTitle>No assistants enabled</CardTitle>
            <CardDescription>
              Choose what NOVA helps you with from Settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings"
              className="flex h-11 items-center justify-center rounded-2xl border border-border bg-background text-sm font-medium transition-colors hover:bg-muted"
            >
              Open Settings
              <ArrowUpRight className="ml-2 size-4" />
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/reports/weekly"
          className="flex min-h-24 flex-col justify-between rounded-3xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur transition-colors hover:bg-muted"
        >
          <BarChart3 className="size-6 text-primary" />
          <span className="space-y-1 text-sm font-medium">
            <span className="block">Reports</span>
            <span className="block text-xs font-normal text-muted-foreground">
              View trends and insights
            </span>
            <span className="flex items-center justify-between">
              Open reports
              <ArrowUpRight className="size-4" />
            </span>
          </span>
        </Link>
        {user.assistantHabits ? (
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
        ) : null}
        {user.assistantWeight ? (
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
        ) : null}
      </section>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Important Documents</CardTitle>
            <CardDescription>Passport, licence and insurance records</CardDescription>
          </div>
          <Link
            href="/documents/new"
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Add document
          </Link>
        </CardHeader>
        <CardContent>
          {importantDocuments.length > 0 ? (
            <section className="grid gap-3 sm:grid-cols-3">
              {importantDocuments.map((document) => {
                const imageSrc = getImportantDocumentImageSrc(document);

                return (
                  <article
                    key={document.id}
                    className="flex min-h-56 flex-col overflow-hidden rounded-3xl border border-border bg-background/40"
                  >
                    {imageSrc ? (
                      <div className="relative aspect-[4/3] border-b border-border bg-muted/70">
                        <Image
                          alt={document.title}
                          className="object-cover"
                          fill
                          sizes="(min-width: 640px) 33vw, 100vw"
                          src={imageSrc}
                        />
                      </div>
                    ) : (
                      <div className="grid aspect-[4/3] place-items-center border-b border-border bg-muted/70">
                        <div className="grid size-14 place-items-center rounded-2xl border border-border bg-background text-muted-foreground shadow-sm">
                          <FileText className="size-7" />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-3 p-3">
                      <div className="min-w-0 space-y-1">
                        <h3 className="truncate font-semibold">
                          {document.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {formatImportantDocumentType(document.type)}
                        </p>
                        {document.expiryDate ? (
                          <p className="text-xs text-muted-foreground">
                            Expires {formatShortUkDate(document.expiryDate)}
                          </p>
                        ) : null}
                      </div>
                      <Link
                        href={`/documents/${document.id}`}
                        className="mt-auto inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        <Eye className="size-4" />
                        View
                      </Link>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <div className="rounded-3xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              No important documents saved yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

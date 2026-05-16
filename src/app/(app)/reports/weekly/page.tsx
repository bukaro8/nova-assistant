import Link from "next/link";
import { ArrowLeft, BarChart3, Dumbbell, ReceiptText, Scale } from "lucide-react";

import { CategoryBreakdownChart } from "@/components/category-breakdown-chart";
import { HabitToast } from "@/components/habit-manage-controls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WeeklySpendingChart } from "@/components/weekly-spending-chart";
import { formatCurrency } from "@/lib/currency";
import {
  formatShortUkDate,
  formatUkDate,
  getCurrentUkWeekRange,
  getUkClock,
  getWeekChartDays,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import { getExpenseCategoryLabel } from "@/server/expenses/categorise-expense";

export const dynamic = "force-dynamic";

function totalSpend(
  expenses: Array<{
    amount: unknown;
  }>,
) {
  return expenses
    .filter((expense) => Number(expense.amount) > 0)
    .reduce((total, expense) => total + Number(expense.amount), 0);
}

function buildCategoryData(
  expenses: Array<{
    amount: unknown;
    category: string | null;
  }>,
) {
  const totals = new Map<string, number>();

  for (const expense of expenses) {
    const amount = Number(expense.amount);

    if (amount <= 0) {
      continue;
    }

    const category = getExpenseCategoryLabel(expense.category);
    totals.set(category, (totals.get(category) ?? 0) + amount);
  }

  return Array.from(totals.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export default async function WeeklyReportPage() {
  const user = await requireCurrentUser();
  const week = getCurrentUkWeekRange();
  const chartData = getWeekChartDays(week.start);
  const weekDays = chartData.map((day) => ({
    dateKey: day.key,
    dayCode: getUkClock(new Date(`${day.key}T12:00:00.000Z`)).dayCode,
  }));

  const [expenses, habits, habitLogs, weightLogs] = await Promise.all([
    prisma.expense.findMany({
      where: {
        userId: user.id,
        expenseDate: {
          gte: week.start,
          lt: week.end,
        },
      },
      orderBy: {
        expenseDate: "desc",
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
          gte: week.start,
          lt: week.end,
        },
      },
    }),
    prisma.weightLog.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: week.start,
          lt: week.end,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  const positiveExpenses = expenses.filter((expense) => Number(expense.amount) > 0);
  const weekTotal = totalSpend(expenses);
  const categoryData = buildCategoryData(expenses);
  const topExpenses = positiveExpenses
    .toSorted((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);
  const completedHabitKeys = new Set(
    habitLogs.map((log) => `${log.habitId}:${getUkClock(log.loggedAt).dateKey}`),
  );
  const scheduledHabitKeys = new Set<string>();

  for (const habit of habits) {
    for (const day of weekDays) {
      if (habit.scheduleDays.includes(day.dayCode)) {
        scheduledHabitKeys.add(`${habit.id}:${day.dateKey}`);
      }
    }
  }

  const habitCompletionTotal = scheduledHabitKeys.size;
  const habitCompletionDone = Array.from(scheduledHabitKeys).filter((key) =>
    completedHabitKeys.has(key),
  ).length;
  const habitCompletionPercent =
    habitCompletionTotal === 0
      ? 0
      : Math.round((habitCompletionDone / habitCompletionTotal) * 100);
  const firstWeight = weightLogs[0] ?? null;
  const latestWeight = weightLogs.at(-1) ?? null;
  const weightChange =
    user.assistantWeight && firstWeight && latestWeight && weightLogs.length > 1
      ? Number(latestWeight.weight) - Number(firstWeight.weight)
      : null;

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
      <header className="space-y-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {formatShortUkDate(week.start)} to {formatShortUkDate(new Date(week.end.getTime() - 1))}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Weekly report
          </h1>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="size-5 text-primary" />
              Total spent
            </CardTitle>
            <CardDescription>Current week</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {formatCurrency(weekTotal, user.currency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" />
              Categories
            </CardTitle>
            <CardDescription>With spending</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {categoryData.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="size-5 text-primary" />
              Habits
            </CardTitle>
            <CardDescription>
              {habitCompletionDone}/{habitCompletionTotal} completed
            </CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {habitCompletionPercent}%
          </CardContent>
        </Card>
        {user.assistantWeight ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="size-5 text-primary" />
                Weight
              </CardTitle>
              <CardDescription>Current week change</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {weightChange === null
                ? "No trend"
                : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg`}
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily spending chart</CardTitle>
            <CardDescription>Monday to Sunday</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklySpendingChart data={chartData} currency={user.currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spend by category</CardTitle>
            <CardDescription>
              {formatCurrency(weekTotal, user.currency)} categorised this week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdownChart
              data={categoryData}
              currency={user.currency}
            />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Top 5 expenses</CardTitle>
          <CardDescription>Largest individual spending entries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {topExpenses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              No expenses recorded this week.
            </div>
          ) : (
            topExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/40 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {expense.description}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {getExpenseCategoryLabel(expense.category)} ·{" "}
                    {formatUkDate(expense.expenseDate)}
                  </div>
                </div>
                <div className="shrink-0 font-semibold">
                  {formatCurrency(Number(expense.amount), user.currency)}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { CheckCircle2, Circle, Plus, Scale, WalletCards } from "lucide-react";

import { AssistantDisabledCard } from "@/components/assistant-disabled-card";
import { HabitToast } from "@/components/habit-manage-controls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExpenseCategory } from "@/generated/prisma/enums";
import { formatCurrency } from "@/lib/currency";
import {
  formatStreak,
  getHabitStats,
} from "@/lib/habit-stats";
import {
  getHabitColourOption,
  getHabitIconOption,
} from "@/lib/habits";
import {
  createTodayExpense,
  saveWeight,
  toggleHabitDone,
} from "@/server/dashboard/actions";
import {
  formatUkDate,
  getCurrentUkWeekRange,
  getUkClock,
  getUkDayRange,
  getWeekChartDays,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import { getExpenseCategoryLabel } from "@/server/expenses/categorise-expense";

export const dynamic = "force-dynamic";

const categories = Object.values(ExpenseCategory);

function getCurrentUkMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return Number(value("hour")) * 60 + Number(value("minute"));
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function formatRelativeMinutes(minutes: number) {
  if (minutes <= 0) {
    return "due now";
  }

  if (minutes < 60) {
    return `in ${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes === 0
    ? `in ${hours}h`
    : `in ${hours}h ${remainingMinutes}m`;
}

export default async function TodayPage() {
  const user = await requireCurrentUser();

  if (!user.assistantHabits) {
    return (
      <AssistantDisabledCard
        title="Habits assistant is disabled"
        description="Enable habits when you want NOVA to manage reminders, streaks and routines."
      />
    );
  }

  const today = getUkDayRange();
  const week = getCurrentUkWeekRange();
  const todayClock = getUkClock();
  const weekDays = getWeekChartDays(week.start).map((day) => ({
    dateKey: day.key,
    dayCode: getUkClock(new Date(`${day.key}T12:00:00.000Z`)).dayCode,
  }));
  const [habits, todayExpenses, latestWeight] = await Promise.all([
    prisma.habit.findMany({
      where: {
        userId: user.id,
        active: true,
      },
      orderBy: {
        reminderTime: "asc",
      },
      include: {
        logs: {
          where: {
            userId: user.id,
            status: "DONE",
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: {
        userId: user.id,
        expenseDate: {
          gte: today.start,
          lt: today.end,
        },
      },
    }),
    prisma.weightLog.findFirst({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);
  const todayHabits = habits.filter((habit) =>
    habit.scheduleDays.includes(todayClock.dayCode),
  );
  const completedToday = new Set(
    todayHabits
      .filter((habit) =>
        habit.logs.some(
          (log) => log.loggedAt >= today.start && log.loggedAt < today.end,
        ),
      )
      .map((habit) => habit.id),
  );
  const completedCount = completedToday.size;
  const pendingCount = Math.max(0, todayHabits.length - completedCount);
  const completionPercentage =
    todayHabits.length === 0
      ? 0
      : Math.round((completedCount / todayHabits.length) * 100);
  const currentMinutes = getCurrentUkMinutes();
  const nextHabit =
    todayHabits.find((habit) => !completedToday.has(habit.id)) ?? null;
  const nextHabitMinutes = nextHabit
    ? timeToMinutes(nextHabit.reminderTime) - currentMinutes
    : null;
  const todaySpend = todayExpenses
    .filter((expense) => Number(expense.amount) > 0)
    .reduce((total, expense) => total + Number(expense.amount), 0);
  const bestCurrentStreak = Math.max(
    0,
    ...habits.map(
      (habit) =>
        getHabitStats({
          habit,
          logs: habit.logs,
          weekDays,
          todayDateKey: today.dateKey,
        }).currentStreak,
    ),
  );

  return (
    <div className="space-y-5">
      <HabitToast />
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {formatUkDate(new Date())}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
      </header>

      <Card className="overflow-hidden border-primary/20 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_26%,transparent),var(--card))]">
        <CardHeader>
          <CardTitle>Today summary</CardTitle>
          <CardDescription>
            {completedCount} complete · {pendingCount} pending
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-5">
            <div>
              <div className="text-5xl font-semibold tracking-tight">
                {completionPercentage}%
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {todayHabits.length === 0
                  ? "No habits scheduled today."
                  : completionPercentage === 100
                    ? "Everything completed today"
                    : "Keep the day moving"}
              </p>
            </div>
            <div className="grid size-24 place-items-center rounded-full border border-primary/35 bg-background/25 text-2xl font-semibold shadow-inner">
              {completedCount}/{todayHabits.length}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next habit</CardTitle>
          <CardDescription>What needs attention next.</CardDescription>
        </CardHeader>
        <CardContent>
          {nextHabit ? (
            <div className="flex items-center gap-3">
              <div
                className={`grid size-12 place-items-center rounded-2xl ${
                  getHabitColourOption(nextHabit.colour).icon
                }`}
              >
                {(() => {
                  const Icon = getHabitIconOption(nextHabit.icon).icon;
                  return <Icon className="size-5" />;
                })()}
              </div>
              <div>
                <div className="text-xl font-semibold">{nextHabit.name}</div>
                <div className="text-sm text-muted-foreground">
                  {nextHabit.reminderTime} ·{" "}
                  {formatRelativeMinutes(nextHabitMinutes ?? 0)}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              Everything completed today
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        {user.assistantExpenses ? (
          <Card>
            <CardHeader>
              <CardTitle>Today spending</CardTitle>
              <CardDescription>Logged today</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatCurrency(todaySpend, user.currency)}
            </CardContent>
          </Card>
        ) : null}
        {user.assistantWeight ? (
          <Card>
            <CardHeader>
              <CardTitle>Latest weight</CardTitle>
              <CardDescription>
                {latestWeight ? formatUkDate(latestWeight.createdAt) : "No logs yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {latestWeight ? `${Number(latestWeight.weight).toFixed(1)} kg` : "No data"}
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Best streak</CardTitle>
            <CardDescription>Current active habits</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatStreak(bestCurrentStreak)}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Today timeline</CardTitle>
          <CardDescription>Chronological habit plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {todayHabits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              No habits scheduled today.
            </div>
          ) : (
            todayHabits.map((habit) => {
              const completed = completedToday.has(habit.id);
              const Icon = getHabitIconOption(habit.icon).icon;
              const colour = getHabitColourOption(habit.colour);
              const action = toggleHabitDone.bind(null, habit.id, "/today");

              return (
                <div
                  key={habit.id}
                  className="rounded-3xl border border-border bg-background/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid size-11 shrink-0 place-items-center rounded-2xl ${colour.icon}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {completed ? (
                          <CheckCircle2 className="size-4 text-emerald-400" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground" />
                        )}
                        <span className="truncate font-medium">{habit.name}</span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {habit.reminderTime}
                      </div>
                    </div>
                    <form action={action}>
                      <Button
                        className="h-10 rounded-2xl"
                        type="submit"
                        variant={completed ? "outline" : "default"}
                      >
                        {completed ? "Undo" : "Done"}
                      </Button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <section className="grid gap-3 lg:grid-cols-2">
        {user.assistantWeight ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="size-5 text-primary" />
                Quick add weight
              </CardTitle>
              <CardDescription>Date defaults to today.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveWeight} className="space-y-3">
                <input
                  className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  inputMode="decimal"
                  name="weight"
                  placeholder="82.5"
                  required
                  type="number"
                  step="0.1"
                />
                <Button className="h-12 w-full rounded-xl" type="submit">
                  <Plus className="size-4" />
                  Save weight
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {user.assistantExpenses ? (
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="size-5 text-primary" />
              Quick add expense
            </CardTitle>
            <CardDescription>Date defaults to today.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createTodayExpense} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  name="amount"
                  placeholder="15.48"
                  required
                  step="0.01"
                  type="number"
                />
                <select
                  className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  name="category"
                  defaultValue=""
                >
                  <option value="">Auto categorise</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {getExpenseCategoryLabel(category)}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                name="description"
                placeholder="Aldi"
                required
              />
              <Button className="h-12 w-full rounded-xl" type="submit">
                <Plus className="size-4" />
                Save expense
              </Button>
            </form>
          </CardContent>
        </Card>
        ) : null}
      </section>
    </div>
  );
}

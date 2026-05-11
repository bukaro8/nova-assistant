import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

import { toggleHabitDone } from "@/server/dashboard/actions";
import { HabitToast } from "@/components/habit-manage-controls";
import {
  getHabitColourOption,
  getHabitIconOption,
} from "@/lib/habits";
import {
  formatStreak,
  formatWeeklyProgress,
  getHabitStats,
} from "@/lib/habit-stats";
import {
  getCurrentUkWeekRange,
  getUkClock,
  getUkDayRange,
  getWeekChartDays,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const user = await requireCurrentUser();
  const today = getUkDayRange();
  const clock = getUkClock();
  const week = getCurrentUkWeekRange();
  const weekDays = getWeekChartDays(week.start).map((day) => ({
    dateKey: day.key,
    dayCode: getUkClock(new Date(`${day.key}T12:00:00.000Z`)).dayCode,
  }));
  const habits = await prisma.habit.findMany({
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
  });

  return (
    <div className="space-y-5">
      <HabitToast />
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{clock.dayCode}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Habits</h1>
        </div>
        <Link
          href="/habits/manage"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Manage habits
        </Link>
      </header>

      {habits.length === 0 ? (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            No active habits yet. Add one from Manage habits.
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          {habits.map((habit) => {
            const completedToday = habit.logs.some(
              (log) => log.loggedAt >= today.start && log.loggedAt < today.end,
            );
            const action = toggleHabitDone.bind(null, habit.id, "/habits");
            const Icon = getHabitIconOption(habit.icon).icon;
            const colour = getHabitColourOption(habit.colour);
            const stats = getHabitStats({
              habit,
              logs: habit.logs,
              weekDays,
              todayDateKey: today.dateKey,
            });
            const status = !stats.scheduledToday
              ? "Not due today"
              : completedToday
                ? "Done"
                : "Pending";

            return (
              <Card key={habit.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div
                      className={`grid size-11 shrink-0 place-items-center rounded-2xl ${colour.icon}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="truncate">{habit.name}</CardTitle>
                      <CardDescription>
                        {habit.reminderTime} · Reply: {habit.code}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    {completedToday ? (
                      <CheckCircle2 className="size-5 text-green-600" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground" />
                    )}
                    <span>{status}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-background/40 p-3">
                      <div className="text-xs text-muted-foreground">
                        Current streak
                      </div>
                      <div className="mt-1 font-semibold">
                        {formatStreak(stats.currentStreak)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/40 p-3">
                      <div className="text-xs text-muted-foreground">
                        Longest streak
                      </div>
                      <div className="mt-1 font-semibold">
                        {stats.longestStreak > 0
                          ? `${stats.longestStreak} days`
                          : "Start today"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/40 p-3">
                      <div className="text-xs text-muted-foreground">
                        This week
                      </div>
                      <div className="mt-1 font-semibold">
                        {formatWeeklyProgress(
                          stats.weeklyCompletedCount,
                          stats.weeklyTotal,
                        )}{" "}
                        · {stats.weeklyPercentage}%
                      </div>
                    </div>
                  </div>
                  {stats.perfectWeekSoFar ? (
                    <div className={`rounded-2xl px-3 py-2 text-sm font-medium ${colour.chip}`}>
                      Perfect week so far
                    </div>
                  ) : stats.currentStreak === 0 && stats.scheduledToday ? (
                    <div className="rounded-2xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                      Start today
                    </div>
                  ) : null}
                  <form action={action}>
                    <Button
                      className="h-11 w-full"
                      type="submit"
                      variant={completedToday ? "outline" : "default"}
                      disabled={!stats.scheduledToday}
                    >
                      {completedToday ? "Undo" : "Mark done"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}

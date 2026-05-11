import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

import { toggleHabitDone } from "@/server/dashboard/actions";
import { HabitToast } from "@/components/habit-manage-controls";
import {
  getHabitColourOption,
  getHabitIconOption,
} from "@/lib/habits";
import { getUkClock, getUkDayRange } from "@/server/dashboard/date-utils";
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
  const habits = await prisma.habit.findMany({
    where: {
      userId: user.id,
      active: true,
      scheduleDays: {
        has: clock.dayCode,
      },
    },
    orderBy: {
      reminderTime: "asc",
    },
    include: {
      logs: {
        where: {
          userId: user.id,
          status: "DONE",
          loggedAt: {
            gte: today.start,
            lt: today.end,
          },
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Today&apos;s habits
          </h1>
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
            No habits scheduled for today.
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          {habits.map((habit) => {
            const completed = habit.logs.length > 0;
            const action = toggleHabitDone.bind(null, habit.id, "/habits");
            const Icon = getHabitIconOption(habit.icon).icon;
            const colour = getHabitColourOption(habit.colour);

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
                    {completed ? (
                      <CheckCircle2 className="size-5 text-green-600" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground" />
                    )}
                    <span>{completed ? "Done" : "Open"}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <form action={action}>
                    <Button
                      className="h-11 w-full"
                      type="submit"
                      variant={completed ? "outline" : "default"}
                    >
                      {completed ? "Undo" : "Mark done"}
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

import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { HabitForm } from "@/components/habit-form";
import {
  setHabitActive,
  createHabit,
  deleteHabit,
  disableHabit,
  updateHabit,
} from "@/server/dashboard/actions";
import {
  getHabitColourOption,
  getHabitIconOption,
} from "@/lib/habits";
import {
  ActiveToggle,
  ConfirmActionButton,
  HabitToast,
} from "@/components/habit-manage-controls";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HabitSettingsPage() {
  const user = await requireCurrentUser();
  const habits = await prisma.habit.findMany({
    where: {
      userId: user.id,
    },
    orderBy: [
      {
        active: "desc",
      },
      {
        reminderTime: "asc",
      },
      {
        name: "asc",
      },
    ],
    include: {
      _count: {
        select: {
          logs: true,
          reminderLogs: true,
        },
      },
    },
  });

  return (
    <div className="space-y-5">
      <HabitToast />
      <header className="space-y-3">
        <Link
          href="/habits"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Habits
        </Link>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Victor-only mode</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Manage habits
          </h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="size-5 text-primary" />
            <CardTitle>Add habit</CardTitle>
          </div>
          <CardDescription>
            These fields drive the dashboard, Telegram replies, and scheduled reminders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HabitForm action={createHabit} submitLabel="Add habit" />
        </CardContent>
      </Card>

      <section className="space-y-3">
        {habits.length === 0 ? (
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground">
              No habits yet. Add your first habit above.
            </CardContent>
          </Card>
        ) : (
          habits.map((habit) => {
            const updateAction = updateHabit.bind(null, habit.id);
            const disableAction = disableHabit.bind(null, habit.id);
            const enableAction = setHabitActive.bind(null, habit.id, true);
            const deleteAction = deleteHabit.bind(null, habit.id);
            const Icon = getHabitIconOption(habit.icon).icon;
            const colour = getHabitColourOption(habit.colour);

            return (
              <Card key={habit.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <span
                          className={`grid size-9 place-items-center rounded-2xl ${colour.icon}`}
                        >
                          <Icon className="size-4" />
                        </span>
                        {habit.name}
                      </CardTitle>
                      <CardDescription>
                        {habit.code} · {habit.reminderTime} ·{" "}
                        {habit.active ? "Active" : "Disabled"}
                      </CardDescription>
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        habit.active
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {habit.active ? "Active" : "Off"}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <div>Replies: {habit.validReplies.join(", ")}</div>
                    <div>Retries: {habit.retryTimes.join(", ") || "None"}</div>
                    <div>Days: {habit.scheduleDays.join(", ")}</div>
                    <div>
                      Style: {getHabitIconOption(habit.icon).label},{" "}
                      {colour.label}
                    </div>
                    <div>
                      History: {habit._count.logs} habit logs,{" "}
                      {habit._count.reminderLogs} reminders
                    </div>
                  </div>

                  <details className="rounded-2xl border border-border bg-background/40 p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Edit habit
                    </summary>
                    <div className="mt-4">
                      <HabitForm
                        action={updateAction}
                        habit={habit}
                        submitLabel="Save changes"
                      />
                    </div>
                  </details>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <ActiveToggle
                      active={habit.active}
                      enableAction={enableAction}
                      disableAction={disableAction}
                    />
                    <ConfirmActionButton
                      action={deleteAction}
                      buttonLabel="Delete"
                      title="Delete this habit?"
                      message="This cannot be undone."
                      confirmLabel="Delete"
                      variant="destructive"
                      showTrashIcon
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

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
  habitColourOptions,
  habitIconOptions,
} from "@/lib/habits";
import {
  ActiveToggle,
  ConfirmActionButton,
  HabitToast,
} from "@/components/habit-manage-controls";
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

const weekDays = [
  { code: "MON", label: "Mon" },
  { code: "TUE", label: "Tue" },
  { code: "WED", label: "Wed" },
  { code: "THU", label: "Thu" },
  { code: "FRI", label: "Fri" },
  { code: "SAT", label: "Sat" },
  { code: "SUN", label: "Sun" },
];

type HabitFormHabit = {
  name: string;
  code: string;
  reminderMessage: string;
  icon: string;
  colour: string;
  reminderTime: string;
  retryTimes: string[];
  validReplies: string[];
  scheduleDays: string[];
  active: boolean;
};

const fieldClass =
  "mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const textAreaClass =
  "mt-1 min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className={fieldClass}
        name={name}
        defaultValue={defaultValue}
        required={required}
        type={type}
        placeholder={placeholder}
      />
    </label>
  );
}

function HabitForm({
  action,
  habit,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  habit?: HabitFormHabit;
  submitLabel: string;
}) {
  const selectedDays = new Set(habit?.scheduleDays ?? []);
  const selectedIcon = habit?.icon ?? "circle";
  const selectedColour = habit?.colour ?? "emerald";

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Name"
          name="name"
          defaultValue={habit?.name}
          required
          placeholder="Study"
        />
        <Field
          label="Code"
          name="code"
          defaultValue={habit?.code}
          required
          placeholder="Study"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Icon</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {habitIconOptions.map((option) => {
            const Icon = option.icon;

            return (
              <label
                key={option.value}
                className="flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border border-border bg-background px-3 text-sm transition has-[:checked]:border-primary has-[:checked]:bg-primary/10"
              >
                <input
                  className="sr-only"
                  name="icon"
                  type="radio"
                  value={option.value}
                  defaultChecked={selectedIcon === option.value}
                />
                <Icon className="size-4 text-primary" />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Colour</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {habitColourOptions.map((option) => (
            <label
              key={option.value}
              className="flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border border-border bg-background px-3 text-sm transition has-[:checked]:border-primary has-[:checked]:bg-primary/10"
            >
              <input
                className="sr-only"
                name="colour"
                type="radio"
                value={option.value}
                defaultChecked={selectedColour === option.value}
              />
              <span className={`size-4 rounded-full ${option.swatch}`} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm font-medium">
        Reminder message
        <textarea
          className={textAreaClass}
          name="reminderMessage"
          defaultValue={habit?.reminderMessage}
          required
          placeholder="Have you studied today? Reply: Study"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Reminder time"
          name="reminderTime"
          defaultValue={habit?.reminderTime}
          required
          type="time"
        />
        <Field
          label="Retry times"
          name="retryTimes"
          defaultValue={habit?.retryTimes.join(", ")}
          placeholder="16:00, 18:00"
        />
      </div>

      <Field
        label="Valid replies"
        name="validReplies"
        defaultValue={habit?.validReplies.join(", ")}
        required
        placeholder="study, Study"
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Schedule days</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {weekDays.map((day) => (
            <label
              key={day.code}
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-2 text-sm"
            >
              <input
                name="scheduleDays"
                type="checkbox"
                value={day.code}
                defaultChecked={selectedDays.has(day.code)}
                className="size-4 accent-primary"
              />
              {day.label}
            </label>
          ))}
        </div>
      </fieldset>

      {habit ? (
        <input
          name="active"
          type="hidden"
          value={habit.active ? "on" : "off"}
        />
      ) : (
        <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-background px-3 text-sm font-medium">
          <input
            name="active"
            type="checkbox"
            defaultChecked
            className="size-4 accent-primary"
          />
          Active
        </label>
      )}

      <Button className="h-11 w-full rounded-2xl" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}

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

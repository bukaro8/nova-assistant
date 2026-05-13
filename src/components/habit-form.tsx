"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  habitColourOptions,
  habitIconOptions,
  type HabitColourValue,
  type HabitIconValue,
} from "@/lib/habits";

const weekDays = [
  { code: "MON", label: "Mon" },
  { code: "TUE", label: "Tue" },
  { code: "WED", label: "Wed" },
  { code: "THU", label: "Thu" },
  { code: "FRI", label: "Fri" },
  { code: "SAT", label: "Sat" },
  { code: "SUN", label: "Sun" },
];

const iconEmoji: Record<HabitIconValue, string> = {
  pill: "💊",
  dumbbell: "💪",
  book: "📘",
  walk: "🚶",
  sleep: "😴",
  water: "💧",
  meditation: "✨",
  food: "🍽️",
  heart: "❤️",
  work: "💼",
  circle: "•",
};

export type HabitFormHabit = {
  name: string;
  code: string;
  reminderMessage: string;
  icon: string;
  colour: string;
  reminderTime: string;
  retryTimes: string[];
  scheduleDays: string[];
  active: boolean;
};

const fieldClass =
  "mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const textAreaClass =
  "mt-1 min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function generateHabitCode(name: string) {
  const firstWord = name
    .trim()
    .toLowerCase()
    .split(/\s+/)[0]
    ?.replace(/[^a-z0-9]/g, "");

  if (!firstWord) {
    return "";
  }

  return firstWord.length <= 5 ? firstWord : firstWord.slice(0, 4);
}

function defaultActionText(name: string) {
  return name.trim() ? `done ${name.trim()}` : "";
}

function buildReminderMessage({
  actionText,
  code,
  icon,
}: {
  actionText: string;
  code: string;
  icon: string;
}) {
  if (!actionText.trim() || !code) {
    return "";
  }

  const cleanActionText = actionText.trim().replace(/[?？]+$/u, "").trim();

  return [`Have you ${cleanActionText} ${icon}?`, `Reply: ${code}`].join(
    "\n",
  );
}

function isGeneratedReminderMessage({
  message,
  actionText,
  code,
  icon,
}: {
  message: string;
  actionText: string;
  code: string;
  icon: string;
}) {
  return (
    message.trim() ===
    buildReminderMessage({
      actionText,
      code,
      icon,
    })
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
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
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

export function HabitForm({
  action,
  habit,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  habit?: HabitFormHabit;
  submitLabel: string;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [icon, setIcon] = useState<HabitIconValue>(
    (habit?.icon as HabitIconValue | undefined) ?? "circle",
  );
  const [colour, setColour] = useState<HabitColourValue>(
    (habit?.colour as HabitColourValue | undefined) ?? "emerald",
  );
  const [reminderTime, setReminderTime] = useState(habit?.reminderTime ?? "");
  const [extraReminderInput, setExtraReminderInput] = useState("");
  const [extraReminders, setExtraReminders] = useState(habit?.retryTimes ?? []);
  const [actionText, setActionText] = useState(
    habit ? defaultActionText(habit.name) : "",
  );
  const [active, setActive] = useState(habit?.active ?? true);
  const [customMessage, setCustomMessage] = useState(() => {
    if (!habit) {
      return false;
    }

    const generatedCode = generateHabitCode(habit.name);
    const generatedActionText = defaultActionText(habit.name);
    const generatedIcon =
      iconEmoji[(habit.icon as HabitIconValue | undefined) ?? "circle"];

    return !isGeneratedReminderMessage({
      message: habit.reminderMessage,
      actionText: generatedActionText,
      code: generatedCode,
      icon: generatedIcon,
    });
  });
  const [manualReminderMessage, setManualReminderMessage] = useState(
    habit?.reminderMessage ?? "",
  );

  const selectedDays = new Set(habit?.scheduleDays ?? []);
  const code = generateHabitCode(name);
  const selectedEmoji = iconEmoji[icon];
  const generatedReminderMessage = useMemo(
    () =>
      buildReminderMessage({
        actionText,
        code,
        icon: selectedEmoji,
      }),
    [actionText, code, selectedEmoji],
  );
  const reminderMessage = customMessage
    ? manualReminderMessage
    : generatedReminderMessage;

  function addExtraReminder() {
    const nextTime = extraReminderInput.trim();

    if (!nextTime) {
      return;
    }

    if (
      nextTime === reminderTime ||
      extraReminders.includes(nextTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(nextTime)
    ) {
      return;
    }

    setExtraReminders((current) => [...current, nextTime].sort());
    setExtraReminderInput("");
  }

  function removeExtraReminder(time: string) {
    setExtraReminders((current) => current.filter((item) => item !== time));
  }

  return (
    <form action={action} className="space-y-4">
      <input name="code" type="hidden" value={code} />
      <input name="validReplies" type="hidden" value={code} />
      <input name="retryTimes" type="hidden" value={extraReminders.join(", ")} />
      <input name="reminderMessage" type="hidden" value={reminderMessage} />

      <Field
        label="Name"
        name="name"
        onChange={setName}
        placeholder="Study"
        required
        value={name}
      />

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
                  checked={icon === option.value}
                  className="sr-only"
                  name="icon"
                  onChange={() => setIcon(option.value)}
                  type="radio"
                  value={option.value}
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
                checked={colour === option.value}
                className="sr-only"
                name="colour"
                onChange={() => setColour(option.value)}
                type="radio"
                value={option.value}
              />
              <span className={`size-4 rounded-full ${option.swatch}`} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3 rounded-3xl border border-border bg-background/50 p-4">
        <Field
          label="What should we ask?"
          onChange={setActionText}
          placeholder="studied English today"
          required={!customMessage}
          value={actionText}
        />
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <span>taken your medication</span>
          <span>studied English today</span>
          <span>done your workout</span>
          <span>drunk enough water</span>
        </div>

        <div className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
          <div className="font-medium text-foreground">
            Telegram reminder preview
          </div>
          <div className="mt-1 whitespace-pre-line">
            {generatedReminderMessage ||
              "Add an action text to preview the reminder."}
          </div>
        </div>

        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input
            checked={customMessage}
            className="size-4 accent-primary"
            onChange={(event) => setCustomMessage(event.target.checked)}
            type="checkbox"
          />
          Use a custom reminder message
        </label>

        {customMessage ? (
          <label className="block text-sm font-medium">
            Custom reminder message
            <textarea
              className={textAreaClass}
              onChange={(event) => setManualReminderMessage(event.target.value)}
              placeholder={`Have you ${actionText || "done this"} ${selectedEmoji}?\nReply: ${code || "code"}`}
              required
              value={manualReminderMessage}
            />
          </label>
        ) : null}
      </div>

      <div className="space-y-3 rounded-3xl border border-border bg-background/50 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="First reminder"
            name="reminderTime"
            onChange={setReminderTime}
            required
            type="time"
            value={reminderTime}
          />
          <label className="block text-sm font-medium">
            Reminder times
            <div className="mt-1 flex gap-2">
              <input
                className={fieldClass}
                onChange={(event) => setExtraReminderInput(event.target.value)}
                type="time"
                value={extraReminderInput}
              />
              <Button
                className="h-11 rounded-2xl"
                onClick={addExtraReminder}
                type="button"
                variant="outline"
              >
                <Plus className="size-4" />
                Add another reminder
              </Button>
            </div>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {reminderTime ? (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {reminderTime}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Choose a first reminder time.
            </span>
          )}
          {extraReminders.map((time) => (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
              key={time}
            >
              {time}
              <button
                aria-label={`Remove ${time}`}
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => removeExtraReminder(time)}
                type="button"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Schedule days</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {weekDays.map((day) => (
            <label
              key={day.code}
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-2 text-sm"
            >
              <input
                className="size-4 accent-primary"
                defaultChecked={selectedDays.has(day.code)}
                name="scheduleDays"
                type="checkbox"
                value={day.code}
              />
              {day.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-background px-3 text-sm font-medium">
        <input
          checked={active}
          className="size-4 accent-primary"
          name="active"
          onChange={(event) => setActive(event.target.checked)}
          type="checkbox"
        />
        Active
      </label>

      <Button className="h-11 w-full rounded-2xl" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}

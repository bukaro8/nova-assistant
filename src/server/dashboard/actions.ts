"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/server/db/prisma";
import {
  getUkDayRange,
  getUtcForUkDateInput,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";

const VALID_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type HabitFormData = {
  name: string;
  code: string;
  reminderMessage: string;
  reminderTime: string;
  retryTimes: string[];
  validReplies: string[];
  scheduleDays: string[];
  active: boolean;
};

type ParsedHabitForm =
  | {
      ok: true;
      data: HabitFormData;
    }
  | {
      ok: false;
      error: string;
    };

function parseList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normaliseCode(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normaliseTime(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseScheduleDays(formData: FormData) {
  return formData
    .getAll("scheduleDays")
    .map((day) => String(day))
    .filter((day): day is (typeof VALID_DAYS)[number] =>
      VALID_DAYS.includes(day as (typeof VALID_DAYS)[number]),
    );
}

function habitRedirectMessage(type: "success" | "error", message: string): never {
  const params = new URLSearchParams({ type, message });
  redirect(`/settings/habits?${params.toString()}`);
}

function parseHabitForm(formData: FormData): ParsedHabitForm {
  const name = String(formData.get("name") ?? "").trim();
  const code = normaliseCode(formData.get("code"));
  const reminderMessage = String(formData.get("reminderMessage") ?? "").trim();
  const reminderTime = normaliseTime(formData.get("reminderTime"));
  const retryTimes = parseList(formData.get("retryTimes"));
  const validReplies = parseList(formData.get("validReplies"));
  const scheduleDays = parseScheduleDays(formData);
  const active = formData.get("active") === "on";

  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  if (!code) {
    return { ok: false, error: "Code is required." };
  }

  if (!reminderTime) {
    return { ok: false, error: "Reminder time is required." };
  }

  if (!reminderMessage) {
    return { ok: false, error: "Reminder message is required." };
  }

  if (!TIME_PATTERN.test(reminderTime)) {
    return { ok: false, error: "Reminder time must use HH:mm format." };
  }

  const invalidRetryTime = retryTimes.find((time) => !TIME_PATTERN.test(time));

  if (invalidRetryTime) {
    return {
      ok: false,
      error: `Retry time "${invalidRetryTime}" must use HH:mm format.`,
    };
  }

  if (validReplies.length === 0) {
    return { ok: false, error: "At least one valid reply is required." };
  }

  if (scheduleDays.length === 0) {
    return { ok: false, error: "At least one schedule day is required." };
  }

  return {
    ok: true,
    data: {
      name,
      code,
      reminderMessage,
      reminderTime,
      retryTimes,
      validReplies,
      scheduleDays,
      active,
    },
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function markHabitDone(habitId: string) {
  const user = await requireCurrentUser();
  const { start, end } = getUkDayRange();
  const loggedAt = new Date();

  const existingLog = await prisma.habitLog.findFirst({
    where: {
      userId: user.id,
      habitId,
      loggedAt: {
        gte: start,
        lt: end,
      },
    },
  });

  if (existingLog) {
    await prisma.habitLog.update({
      where: {
        id: existingLog.id,
      },
      data: {
        status: "DONE",
        source: "dashboard",
        loggedAt,
      },
    });
  } else {
    await prisma.habitLog.create({
      data: {
        userId: user.id,
        habitId,
        status: "DONE",
        source: "dashboard",
        loggedAt,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/habits");
}

export async function saveWeight(formData: FormData) {
  const user = await requireCurrentUser();
  const rawWeight = String(formData.get("weight") ?? "").trim();
  const rawDate = String(formData.get("date") ?? "").trim();
  const weight = Number(rawWeight);

  if (!rawWeight || Number.isNaN(weight) || weight <= 0) {
    return;
  }

  const createdAt = rawDate ? getUtcForUkDateInput(rawDate) : new Date();

  await prisma.weightLog.create({
    data: {
      userId: user.id,
      weight: rawWeight,
      createdAt,
      source: "dashboard",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/weight");
}

export async function createHabit(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = parseHabitForm(formData);

  if (!parsed.ok) {
    habitRedirectMessage("error", parsed.error);
  }

  try {
    await prisma.habit.create({
      data: {
        userId: user.id,
        ...parsed.data,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      habitRedirectMessage("error", "A habit with this code already exists.");
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/habits");
  revalidatePath("/settings");
  revalidatePath("/settings/habits");
  habitRedirectMessage("success", "Habit added.");
}

export async function updateHabit(habitId: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = parseHabitForm(formData);

  if (!parsed.ok) {
    habitRedirectMessage("error", parsed.error);
  }

  const habit = await prisma.habit.findFirst({
    where: {
      id: habitId,
      userId: user.id,
    },
  });

  if (!habit) {
    habitRedirectMessage("error", "Habit not found.");
  }

  try {
    await prisma.habit.update({
      where: {
        id: habitId,
      },
      data: parsed.data,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      habitRedirectMessage("error", "A habit with this code already exists.");
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/habits");
  revalidatePath("/settings");
  revalidatePath("/settings/habits");
  habitRedirectMessage("success", "Habit updated.");
}

export async function disableHabit(habitId: string) {
  const user = await requireCurrentUser();

  await prisma.habit.updateMany({
    where: {
      id: habitId,
      userId: user.id,
    },
    data: {
      active: false,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/habits");
  revalidatePath("/settings/habits");
  habitRedirectMessage("success", "Habit disabled.");
}

export async function deleteHabit(habitId: string) {
  const user = await requireCurrentUser();
  const habit = await prisma.habit.findFirst({
    where: {
      id: habitId,
      userId: user.id,
    },
    include: {
      _count: {
        select: {
          logs: true,
          reminderLogs: true,
        },
      },
    },
  });

  if (!habit) {
    habitRedirectMessage("error", "Habit not found.");
  }

  if (habit._count.logs > 0 || habit._count.reminderLogs > 0) {
    habitRedirectMessage(
      "error",
      "This habit has history. Disable it instead.",
    );
  }

  await prisma.habit.delete({
    where: {
      id: habitId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/habits");
  revalidatePath("/settings/habits");
  habitRedirectMessage("success", "Habit deleted.");
}

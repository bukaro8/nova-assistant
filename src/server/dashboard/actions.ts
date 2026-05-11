"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/server/db/prisma";
import { ExpenseCategory } from "@/generated/prisma/enums";
import { isCurrencyCode } from "@/lib/currency";
import {
  isHabitColourValue,
  isHabitIconValue,
} from "@/lib/habits";
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
  icon: string;
  colour: string;
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
  redirect(`/habits/manage?${params.toString()}`);
}

function dashboardRedirectMessage({
  path,
  type,
  message,
}: {
  path: "/dashboard" | "/habits";
  type: "success" | "error";
  message: string;
}): never {
  const params = new URLSearchParams({ type, message });
  redirect(`${path}?${params.toString()}`);
}

function expensesRedirectMessage(type: "success" | "error", message: string): never {
  const params = new URLSearchParams({ type, message });
  redirect(`/expenses?${params.toString()}`);
}

function invalidForm(message = "Invalid form"): never {
  habitRedirectMessage("error", message);
}

function parseHabitForm(formData: FormData): ParsedHabitForm {
  const name = String(formData.get("name") ?? "").trim();
  const code = normaliseCode(formData.get("code"));
  const reminderMessage = String(formData.get("reminderMessage") ?? "").trim();
  const icon = String(formData.get("icon") ?? "circle").trim();
  const colour = String(formData.get("colour") ?? "emerald").trim();
  const reminderTime = normaliseTime(formData.get("reminderTime"));
  const retryTimes = parseList(formData.get("retryTimes"));
  const validReplies = parseList(formData.get("validReplies"));
  const scheduleDays = parseScheduleDays(formData);
  const active = formData.get("active") === "on";

  if (!name) {
    return { ok: false, error: "Invalid form" };
  }

  if (!code) {
    return { ok: false, error: "Invalid form" };
  }

  if (!reminderTime) {
    return { ok: false, error: "Invalid form" };
  }

  if (!reminderMessage) {
    return { ok: false, error: "Invalid form" };
  }

  if (!isHabitIconValue(icon) || !isHabitColourValue(colour)) {
    return { ok: false, error: "Invalid form" };
  }

  if (!TIME_PATTERN.test(reminderTime)) {
    return { ok: false, error: "Invalid form" };
  }

  const invalidRetryTime = retryTimes.find((time) => !TIME_PATTERN.test(time));

  if (invalidRetryTime) {
    return {
      ok: false,
      error: "Invalid form",
    };
  }

  if (validReplies.length === 0) {
    return { ok: false, error: "Invalid form" };
  }

  if (scheduleDays.length === 0) {
    return { ok: false, error: "Invalid form" };
  }

  return {
    ok: true,
    data: {
      name,
      code,
      reminderMessage,
      icon,
      colour,
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

async function assertHabitCodeIsUnique({
  userId,
  code,
  excludeHabitId,
}: {
  userId: string;
  code: string;
  excludeHabitId?: string;
}) {
  const existing = await prisma.habit.findFirst({
    where: {
      userId,
      code,
      ...(excludeHabitId
        ? {
            id: {
              not: excludeHabitId,
            },
          }
        : {}),
    },
  });

  if (existing) {
    habitRedirectMessage("error", "Duplicate code");
  }
}

async function assertValidRepliesDoNotOverlap({
  userId,
  validReplies,
  excludeHabitId,
}: {
  userId: string;
  validReplies: string[];
  excludeHabitId?: string;
}) {
  const normalizedReplies = new Set(
    validReplies.map((reply) => reply.trim().toLowerCase()),
  );
  const habits = await prisma.habit.findMany({
    where: {
      userId,
      ...(excludeHabitId
        ? {
            id: {
              not: excludeHabitId,
            },
          }
        : {}),
    },
    select: {
      name: true,
      validReplies: true,
    },
  });
  const overlappingHabit = habits.find((habit) =>
    habit.validReplies.some((reply) =>
      normalizedReplies.has(reply.trim().toLowerCase()),
    ),
  );

  if (overlappingHabit) {
    invalidForm("Invalid form");
  }
}

export async function toggleHabitDone(
  habitId: string,
  redirectPath: "/dashboard" | "/habits",
) {
  const user = await requireCurrentUser();
  const { start, end } = getUkDayRange();
  const loggedAt = new Date();
  const habit = await prisma.habit.findFirst({
    where: {
      id: habitId,
      userId: user.id,
      active: true,
    },
  });

  if (!habit) {
    dashboardRedirectMessage({
      path: redirectPath,
      type: "error",
      message: "Invalid form",
    });
  }

  const existingLog = await prisma.habitLog.findFirst({
    where: {
      userId: user.id,
      habitId,
      status: "DONE",
      loggedAt: {
        gte: start,
        lt: end,
      },
    },
  });

  if (existingLog) {
    await prisma.habitLog.deleteMany({
      where: {
        userId: user.id,
        habitId,
        loggedAt: {
          gte: start,
          lt: end,
        },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/habits");
    dashboardRedirectMessage({
      path: redirectPath,
      type: "success",
      message: "Habit unmarked",
    });
  }

  const skippedLog = await prisma.habitLog.findFirst({
    where: {
      userId: user.id,
      habitId,
      status: {
        not: "DONE",
      },
      loggedAt: {
        gte: start,
        lt: end,
      },
    },
  });

  if (skippedLog) {
    await prisma.habitLog.update({
      where: {
        id: skippedLog.id,
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
  dashboardRedirectMessage({
    path: redirectPath,
    type: "success",
    message: "Habit marked done",
  });
}

export async function markHabitDone(habitId: string) {
  await toggleHabitDone(habitId, "/habits");
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

export async function updateCurrencyPreference(formData: FormData) {
  const user = await requireCurrentUser();
  const currency = String(formData.get("currency") ?? "").trim();

  if (!isCurrencyCode(currency)) {
    const params = new URLSearchParams({
      type: "error",
      message: "Invalid currency",
    });
    redirect(`/settings?${params.toString()}`);
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      currency,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  revalidatePath("/settings");

  const params = new URLSearchParams({
    type: "success",
    message: "Currency updated",
  });
  redirect(`/settings?${params.toString()}`);
}

function parseExpenseForm(formData: FormData) {
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const rawDate = String(formData.get("date") ?? "").trim();
  const amount = Number(rawAmount);

  if (
    !rawAmount ||
    Number.isNaN(amount) ||
    !description ||
    !Object.values(ExpenseCategory).includes(category as ExpenseCategory)
  ) {
    return null;
  }

  return {
    amount: rawAmount,
    description,
    rawText: description,
    category: category as ExpenseCategory,
    expenseDate: rawDate ? getUtcForUkDateInput(rawDate) : new Date(),
  };
}

export async function createExpense(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = parseExpenseForm(formData);

  if (!parsed) {
    expensesRedirectMessage("error", "Invalid expense");
  }

  await prisma.expense.create({
    data: {
      userId: user.id,
      ...parsed,
      source: "dashboard",
      createdVia: "dashboard",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  expensesRedirectMessage("success", "Expense saved");
}

export async function updateExpense(expenseId: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = parseExpenseForm(formData);

  if (!parsed) {
    expensesRedirectMessage("error", "Invalid expense");
  }

  await prisma.expense.updateMany({
    where: {
      id: expenseId,
      userId: user.id,
    },
    data: parsed,
  });

  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  expensesRedirectMessage("success", "Expense updated");
}

export async function deleteExpense(expenseId: string) {
  const user = await requireCurrentUser();

  await prisma.expense.deleteMany({
    where: {
      id: expenseId,
      userId: user.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  expensesRedirectMessage("success", "Expense deleted");
}

export async function createHabit(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = parseHabitForm(formData);

  if (!parsed.ok) {
    invalidForm(parsed.error);
  }

  await assertHabitCodeIsUnique({
    userId: user.id,
    code: parsed.data.code,
  });
  await assertValidRepliesDoNotOverlap({
    userId: user.id,
    validReplies: parsed.data.validReplies,
  });

  try {
    await prisma.habit.create({
      data: {
        userId: user.id,
        ...parsed.data,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      habitRedirectMessage("error", "Duplicate code");
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/habits");
  revalidatePath("/settings");
  revalidatePath("/habits/manage");
  habitRedirectMessage("success", "Habit created");
}

export async function updateHabit(habitId: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = parseHabitForm(formData);

  if (!parsed.ok) {
    invalidForm(parsed.error);
  }

  const habit = await prisma.habit.findFirst({
    where: {
      id: habitId,
      userId: user.id,
    },
  });

  if (!habit) {
    invalidForm("Invalid form");
  }

  await assertHabitCodeIsUnique({
    userId: user.id,
    code: parsed.data.code,
    excludeHabitId: habitId,
  });
  await assertValidRepliesDoNotOverlap({
    userId: user.id,
    validReplies: parsed.data.validReplies,
    excludeHabitId: habitId,
  });

  try {
    await prisma.habit.update({
      where: {
        id: habitId,
      },
      data: parsed.data,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      habitRedirectMessage("error", "Duplicate code");
    }

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/habits");
  revalidatePath("/settings");
  revalidatePath("/habits/manage");
  habitRedirectMessage("success", "Habit updated");
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
  revalidatePath("/habits/manage");
  habitRedirectMessage("success", "Habit disabled");
}

export async function setHabitActive(habitId: string, active: boolean) {
  const user = await requireCurrentUser();

  await prisma.habit.updateMany({
    where: {
      id: habitId,
      userId: user.id,
    },
    data: {
      active,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/habits");
  revalidatePath("/habits/manage");
  habitRedirectMessage("success", active ? "Habit updated" : "Habit disabled");
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
    invalidForm("Invalid form");
  }

  if (habit._count.logs > 0 || habit._count.reminderLogs > 0) {
    habitRedirectMessage(
      "error",
      "Delete blocked because history exists",
    );
  }

  await prisma.habit.delete({
    where: {
      id: habitId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/habits");
  revalidatePath("/habits/manage");
  habitRedirectMessage("success", "Habit deleted");
}

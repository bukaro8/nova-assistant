import type { ExpenseCategory, Prisma, WeeklyAiReport } from "../../generated/prisma/client";

import { generateWeeklyReportInsight } from "../ai/openai";
import { prisma } from "../db/prisma";
import {
  categoriseExpense,
  getExpenseCategoryLabel,
} from "../expenses/categorise-expense";

export const DEFAULT_REPORT_TIME_ZONE = "Europe/London";
export const MANUAL_REGENERATION_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const WEEKLY_REPORT_FALLBACK =
  "NOVA could not generate an AI insight report right now. Your weekly metrics are still available below.";

const DAY_MS = 86_400_000;
const WEEK_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const BASELINE_SPENDING_CATEGORIES = [
  "GROCERIES",
  "HOUSING_BILLS",
  "TRANSPORT",
  "INSURANCE",
] satisfies ExpenseCategory[];
const BEHAVIOURAL_SPENDING_CATEGORIES = [
  "TAKEAWAY",
  "COFFEE_SNACKS",
  "ENTERTAINMENT",
  "SHOPPING",
  "SUBSCRIPTIONS",
  "PERSONAL_CARE",
] satisfies ExpenseCategory[];

type WeekDay = (typeof WEEK_DAYS)[number];

type UserWithAssistants = {
  id: string;
  email?: string | null;
  currency: string;
  assistantHabits: boolean;
  assistantWeight: boolean;
  assistantExpenses: boolean;
  timeZone?: string | null;
};

type ExpenseRecord = {
  id: string;
  amount: unknown;
  description: string;
  category: ExpenseCategory | null;
  expenseDate: Date;
};

type HabitRecord = {
  id: string;
  scheduleDays: string[];
};

type HabitLogRecord = {
  habitId: string;
  loggedAt: Date;
};

type WeightLogRecord = {
  weight: unknown;
};

export type WeeklyMetrics = {
  week: {
    start: string;
    end: string;
    mondayDateKey: string;
    timeZone: string;
  };
  currency: string;
  enabledAssistants: {
    habits: boolean;
    expenses: boolean;
    weight: boolean;
  };
  hasEnabledAssistants: boolean;
  meaningfulActivity: boolean;
  expenses: {
    count: number;
    totalSpent: number;
    spendByCategory: Array<{
      category: ExpenseCategory | "UNCATEGORISED";
      label: string;
      total: number;
    }>;
    spendingSignals: {
      baselineTotal: number;
      behaviouralTotal: number;
      otherTotal: number;
      baselineSharePercent: number;
      behaviouralSharePercent: number;
      mostlyEssentials: boolean;
      grocerySpendUnusuallyHigh: boolean;
      transportSpendUnusuallyHigh: boolean;
      baselineCategories: string[];
      behaviouralCategories: string[];
      interpretationHint: string;
      behaviouralSpendByCategory: Array<{
        category: ExpenseCategory;
        label: string;
        total: number;
      }>;
    };
    dailySpending: Array<{
      key: string;
      label: string;
      total: number;
    }>;
    topExpenses: Array<{
      rank: number;
      amount: number;
      category: ExpenseCategory | null;
      categoryLabel: string;
      insightLabel: string;
      date: string;
    }>;
  };
  habits: {
    activeCount: number;
    scheduledCompletions: number;
    completed: number;
    completionPercent: number;
  };
  weight: {
    enabled: boolean;
    logCount: number;
    firstKg: number | null;
    latestKg: number | null;
    changeKg: number | null;
  };
};

type AiWeeklyMetrics = Omit<WeeklyMetrics, "expenses"> & {
  expenses: Omit<WeeklyMetrics["expenses"], "topExpenses"> & {
    topExpenses: Array<{
      rank: number;
      amount: number;
      category: ExpenseCategory | null;
      categoryLabel: string;
      insightLabel: string;
      date: string;
    }>;
  };
};

export type WeeklyReportState = {
  user: UserWithAssistants;
  week: {
    start: Date;
    end: Date;
    mondayDateKey: string;
    timeZone: string;
  };
  metrics: WeeklyMetrics;
  report: WeeklyAiReport | null;
};

export type WeeklyReportGenerationResult =
  | {
      status: "stored" | "existing";
      report: WeeklyAiReport;
      metrics: WeeklyMetrics;
    }
  | {
      status: "skipped" | "fallback" | "rate-limited";
      report: WeeklyAiReport | null;
      metrics: WeeklyMetrics;
      message: string;
    };

export type SampleWeeklyAiReportResult =
  | {
      status: "stored";
      reportId: string;
      reportText: string;
      model: string;
      userId: string;
    }
  | {
      status: "printed";
      reportText: string;
      model: string;
    };

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  return { year, month, day };
}

function getZonedClock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  const weekday = value("weekday");
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = value("hour");
  const minute = value("minute");

  if (!weekday || !year || !month || !day || !hour || !minute) {
    throw new Error(`Failed to read date in ${timeZone}.`);
  }

  return {
    dateKey: `${year}-${month}-${day}`,
    dayCode: weekday.slice(0, 3).toUpperCase() as WeekDay,
    time: `${hour}:${minute}`,
  };
}

function getUtcForZonedLocal(dateKey: string, time: string, timeZone: string) {
  const { year, month, day } = parseDateKey(dateKey);
  const [hour, minute] = time.split(":").map(Number);

  if (
    hour === undefined ||
    minute === undefined ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    throw new Error(`Invalid time: ${time}`);
  }

  const assumedUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const zonedClock = getZonedClock(assumedUtc, timeZone);
  const formatted = parseDateKey(zonedClock.dateKey);
  const formattedUtcMinutes =
    Date.UTC(
      formatted.year,
      formatted.month - 1,
      formatted.day,
      Number(zonedClock.time.slice(0, 2)),
      Number(zonedClock.time.slice(3, 5)),
    ) / 60_000;
  const wantedUtcMinutes =
    Date.UTC(year, month - 1, day, hour, minute) / 60_000;

  return new Date(
    assumedUtc.getTime() + (wantedUtcMinutes - formattedUtcMinutes) * 60_000,
  );
}

function getNextDateKey(dateKey: string, timeZone: string) {
  const { year, month, day } = parseDateKey(dateKey);

  return getZonedClock(
    new Date(Date.UTC(year, month - 1, day + 1, 12)),
    timeZone,
  ).dateKey;
}

function getReportTimeZone(user: { timeZone?: string | null }) {
  return user.timeZone || DEFAULT_REPORT_TIME_ZONE;
}

export function getWeekRangeForTimeZone(date = new Date(), timeZone = DEFAULT_REPORT_TIME_ZONE) {
  const today = getZonedClock(date, timeZone);
  const dayOffset = WEEK_DAYS.indexOf(today.dayCode);
  const middayToday = new Date(`${today.dateKey}T12:00:00.000Z`);
  const mondayDateKey = getZonedClock(
    new Date(middayToday.getTime() - dayOffset * DAY_MS),
    timeZone,
  ).dateKey;
  let afterSundayDateKey = mondayDateKey;

  for (let index = 0; index < 7; index += 1) {
    afterSundayDateKey = getNextDateKey(afterSundayDateKey, timeZone);
  }

  return {
    start: getUtcForZonedLocal(mondayDateKey, "00:00", timeZone),
    end: getUtcForZonedLocal(afterSundayDateKey, "00:00", timeZone),
    mondayDateKey,
    timeZone,
  };
}

export function getWeekChartDaysForTimeZone(start: Date, timeZone = DEFAULT_REPORT_TIME_ZONE) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);

    return {
      key: getZonedClock(new Date(date.getTime() + 12 * 60 * 60 * 1000), timeZone)
        .dateKey,
      label: new Intl.DateTimeFormat("en-GB", {
        timeZone,
        weekday: "short",
      }).format(date),
      total: 0,
    };
  });
}

export function formatReportDate(date: Date, timeZone = DEFAULT_REPORT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatShortReportDate(date: Date, timeZone = DEFAULT_REPORT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
  }).format(date);
}

function toAiWeeklyMetrics(metrics: WeeklyMetrics): AiWeeklyMetrics {
  // Privacy boundary: metricsJson and OpenAI input must stay sanitised.
  // Do not include raw descriptions, IDs, notes, or personal record text here.
  return {
    ...metrics,
    expenses: {
      ...metrics.expenses,
      topExpenses: metrics.expenses.topExpenses.map((expense, index) => ({
        rank: expense.rank ?? index + 1,
        amount: expense.amount,
        category: expense.category,
        categoryLabel: expense.categoryLabel,
        insightLabel: expense.insightLabel,
        date: expense.date,
      })),
    },
  };
}

function isReclassifiableCategory(category: ExpenseCategory | null) {
  return !category || category === "OTHER";
}

function getReportCategory(expense: ExpenseRecord) {
  if (!isReclassifiableCategory(expense.category)) {
    return expense.category;
  }

  const categorisation = categoriseExpense({
    text: expense.description,
    amount: Number(expense.amount),
  });

  return categorisation.category === "OTHER"
    ? expense.category
    : (categorisation.category as ExpenseCategory);
}

function getSafeInsightLabel(expense: ExpenseRecord, category: ExpenseCategory | null) {
  const categoryLabel = getExpenseCategoryLabel(category);

  if (!category || !isBehaviouralCategory(category)) {
    return categoryLabel;
  }

  const categorisation = categoriseExpense({
    text: expense.description,
    amount: Number(expense.amount),
  });

  if (categorisation.category === category && categorisation.matchedKeyword) {
    return getExpenseCategoryLabel(categorisation.matchedKeyword);
  }

  return categoryLabel;
}

function isBaselineCategory(category: ExpenseCategory | "UNCATEGORISED") {
  return (BASELINE_SPENDING_CATEGORIES as readonly string[]).includes(category);
}

function isBehaviouralCategory(category: ExpenseCategory | "UNCATEGORISED") {
  return (BEHAVIOURAL_SPENDING_CATEGORIES as readonly string[]).includes(category);
}

function sharePercent(total: number, grandTotal: number) {
  if (grandTotal <= 0) {
    return 0;
  }

  return Math.round((total / grandTotal) * 100);
}

function buildSpendingSignals(
  categoryTotals: Map<ExpenseCategory | "UNCATEGORISED", number>,
  totalSpent: number,
) {
  const baselineTotal = roundMoney(
    Array.from(categoryTotals.entries())
      .filter(([category]) => isBaselineCategory(category))
      .reduce((total, [, amount]) => total + amount, 0),
  );
  const behaviouralSpendByCategory = Array.from(categoryTotals.entries())
    .filter(([category]) => isBehaviouralCategory(category))
    .map(([category, total]) => ({
      category: category as ExpenseCategory,
      label: getExpenseCategoryLabel(category),
      total,
    }))
    .sort((a, b) => b.total - a.total);
  const behaviouralTotal = roundMoney(
    behaviouralSpendByCategory.reduce((total, category) => total + category.total, 0),
  );
  const otherTotal = roundMoney(Math.max(totalSpent - baselineTotal - behaviouralTotal, 0));
  const baselineShare = sharePercent(baselineTotal, totalSpent);
  const behaviouralShare = sharePercent(behaviouralTotal, totalSpent);
  const groceryTotal = categoryTotals.get("GROCERIES") ?? 0;
  const transportTotal = categoryTotals.get("TRANSPORT") ?? 0;
  const grocerySpendUnusuallyHigh = groceryTotal >= 150 && sharePercent(groceryTotal, totalSpent) >= 60;
  const transportSpendUnusuallyHigh =
    transportTotal >= 100 && sharePercent(transportTotal, totalSpent) >= 35;
  const mostlyEssentials = baselineShare >= 70 && behaviouralShare <= 20;

  return {
    baselineTotal,
    behaviouralTotal,
    otherTotal,
    baselineSharePercent: baselineShare,
    behaviouralSharePercent: behaviouralShare,
    mostlyEssentials,
    grocerySpendUnusuallyHigh,
    transportSpendUnusuallyHigh,
    baselineCategories: BASELINE_SPENDING_CATEGORIES.map(getExpenseCategoryLabel),
    behaviouralCategories: BEHAVIOURAL_SPENDING_CATEGORIES.map(getExpenseCategoryLabel),
    interpretationHint: mostlyEssentials
      ? "Most spending this week is baseline essentials. Say there is little sign of discretionary overspending unless behavioural categories show a clear pattern."
      : "Prioritise behavioural and discretionary categories over groceries, bills, and normal transport.",
    behaviouralSpendByCategory,
  };
}

function buildSampleAiWeeklyMetrics({
  currency,
  date = new Date(),
}: {
  currency: string;
  date?: Date;
}): { week: { start: Date; end: Date }; metrics: AiWeeklyMetrics } {
  const week = getWeekRangeForTimeZone(date, DEFAULT_REPORT_TIME_ZONE);

  return {
    week,
    metrics: {
      week: {
        start: week.start.toISOString(),
        end: week.end.toISOString(),
        mondayDateKey: week.mondayDateKey,
        timeZone: DEFAULT_REPORT_TIME_ZONE,
      },
      currency,
      enabledAssistants: {
        habits: true,
        expenses: true,
        weight: true,
      },
      hasEnabledAssistants: true,
      meaningfulActivity: true,
      expenses: {
        count: 12,
        totalSpent: 184.35,
        spendByCategory: [
          { category: "GROCERIES", label: "Groceries", total: 76.4 },
          { category: "TAKEAWAY", label: "Takeaway", total: 28 },
          { category: "COFFEE_SNACKS", label: "Coffee Snacks", total: 16.2 },
          { category: "TRANSPORT", label: "Transport", total: 31.75 },
          { category: "SHOPPING", label: "Shopping", total: 32 },
        ],
        spendingSignals: {
          baselineTotal: 108.15,
          behaviouralTotal: 76.2,
          otherTotal: 0,
          baselineSharePercent: 59,
          behaviouralSharePercent: 41,
          mostlyEssentials: false,
          grocerySpendUnusuallyHigh: false,
          transportSpendUnusuallyHigh: false,
          baselineCategories: ["Groceries", "Housing Bills", "Transport"],
          behaviouralCategories: [
            "Takeaway",
            "Coffee Snacks",
            "Entertainment",
            "Shopping",
            "Subscriptions",
            "Personal Care",
          ],
          interpretationHint:
            "Prioritise behavioural and discretionary categories over groceries, bills, and normal transport.",
          behaviouralSpendByCategory: [
            { category: "SHOPPING", label: "Shopping", total: 32 },
            { category: "TAKEAWAY", label: "Takeaway", total: 28 },
            { category: "COFFEE_SNACKS", label: "Coffee Snacks", total: 16.2 },
          ],
        },
        dailySpending: [
          { key: week.mondayDateKey, label: "Mon", total: 18.5 },
          { key: "", label: "Tue", total: 0 },
          { key: "", label: "Wed", total: 42.3 },
          { key: "", label: "Thu", total: 11.25 },
          { key: "", label: "Fri", total: 67.1 },
          { key: "", label: "Sat", total: 45.2 },
          { key: "", label: "Sun", total: 0 },
        ],
        topExpenses: [
          {
            rank: 1,
            amount: 42.3,
            category: "PERSONAL_CARE",
            categoryLabel: "Personal Care",
            insightLabel: "Barber",
            date: "Wednesday",
          },
          {
            rank: 2,
            amount: 31.75,
            category: "TRANSPORT",
            categoryLabel: "Transport",
            insightLabel: "Transport",
            date: "Friday",
          },
          {
            rank: 3,
            amount: 28,
            category: "TAKEAWAY",
            categoryLabel: "Takeaway",
            insightLabel: "Takeaway",
            date: "Saturday",
          },
        ],
      },
      habits: {
        activeCount: 4,
        scheduledCompletions: 22,
        completed: 16,
        completionPercent: 73,
      },
      weight: {
        enabled: true,
        logCount: 3,
        firstKg: 82.4,
        latestKg: 81.9,
        changeKg: -0.5,
      },
    },
  };
}

function hasEnabledAssistants(user: UserWithAssistants) {
  return user.assistantHabits || user.assistantExpenses || user.assistantWeight;
}

async function findUserWithAssistants(userId: string) {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      currency: true,
      assistantHabits: true,
      assistantExpenses: true,
      assistantWeight: true,
    },
  });
}

export async function buildWeeklyMetrics(user: UserWithAssistants, date = new Date()) {
  const timeZone = getReportTimeZone(user);
  const week = getWeekRangeForTimeZone(date, timeZone);
  const chartData = getWeekChartDaysForTimeZone(week.start, timeZone);
  const weekDays = chartData.map((day) => ({
    dateKey: day.key,
    dayCode: getZonedClock(new Date(`${day.key}T12:00:00.000Z`), timeZone).dayCode,
  }));

  const [expenses, habits, habitLogs, weightLogs] = (await Promise.all([
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
  ])) as [ExpenseRecord[], HabitRecord[], HabitLogRecord[], WeightLogRecord[]];

  const positiveExpenses = expenses.filter(
    (expense) =>
      Number(expense.amount) > 0 &&
      expense.category !== "INCOME" &&
      expense.category !== "TRANSFER",
  );
  const categoryTotals = new Map<ExpenseCategory | "UNCATEGORISED", number>();
  const expensesForReport = positiveExpenses.map((expense) => ({
    expense,
    reportCategory: getReportCategory(expense),
  }));

  for (const { expense, reportCategory } of expensesForReport) {
    const amount = Number(expense.amount);
    const category = reportCategory ?? "UNCATEGORISED";
    const key = getZonedClock(expense.expenseDate, timeZone).dateKey;
    const chartPoint = chartData.find((day) => day.key === key);

    if (chartPoint) {
      chartPoint.total = roundMoney(chartPoint.total + amount);
    }

    categoryTotals.set(category, roundMoney((categoryTotals.get(category) ?? 0) + amount));
  }

  const completedHabitKeys = new Set(
    habitLogs.map((log) => `${log.habitId}:${getZonedClock(log.loggedAt, timeZone).dateKey}`),
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
      ? roundMoney(Number(latestWeight.weight) - Number(firstWeight.weight))
      : null;
  const expenseTotal = roundMoney(
    positiveExpenses.reduce((total, expense) => total + Number(expense.amount), 0),
  );
  const meaningfulActivity =
    positiveExpenses.length > 0 || habitLogs.length > 0 || weightLogs.length > 0;

  return {
    week,
    metrics: {
      week: {
        start: week.start.toISOString(),
        end: week.end.toISOString(),
        mondayDateKey: week.mondayDateKey,
        timeZone,
      },
      currency: user.currency,
      enabledAssistants: {
        habits: user.assistantHabits,
        expenses: user.assistantExpenses,
        weight: user.assistantWeight,
      },
      hasEnabledAssistants: hasEnabledAssistants(user),
      meaningfulActivity,
      expenses: {
        count: positiveExpenses.length,
        totalSpent: expenseTotal,
        spendByCategory: Array.from(categoryTotals.entries())
          .map(([category, total]) => ({
            category,
            label:
              category === "UNCATEGORISED"
                ? "Uncategorised"
                : getExpenseCategoryLabel(category),
            total,
          }))
          .sort((a, b) => b.total - a.total),
        spendingSignals: buildSpendingSignals(categoryTotals, expenseTotal),
        dailySpending: chartData,
        topExpenses: expensesForReport
          .toSorted((a, b) => Number(b.expense.amount) - Number(a.expense.amount))
          .slice(0, 5)
          .map(({ expense, reportCategory }, index) => ({
            rank: index + 1,
            amount: Number(expense.amount),
            category: reportCategory,
            categoryLabel: getExpenseCategoryLabel(reportCategory),
            insightLabel: getSafeInsightLabel(expense, reportCategory),
            date: formatReportDate(expense.expenseDate, timeZone),
          })),
      },
      habits: {
        activeCount: habits.length,
        scheduledCompletions: habitCompletionTotal,
        completed: habitCompletionDone,
        completionPercent: habitCompletionPercent,
      },
      weight: {
        enabled: user.assistantWeight,
        logCount: weightLogs.length,
        firstKg: firstWeight ? Number(firstWeight.weight) : null,
        latestKg: latestWeight ? Number(latestWeight.weight) : null,
        changeKg: weightChange,
      },
    } satisfies WeeklyMetrics,
  };
}

export async function getCurrentWeeklyReportState(
  userId: string,
  date = new Date(),
): Promise<WeeklyReportState> {
  const user = await findUserWithAssistants(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  const { week, metrics } = await buildWeeklyMetrics(user, date);
  const report = await prisma.weeklyAiReport.findUnique({
    where: {
      userId_weekStart: {
        userId: user.id,
        weekStart: week.start,
      },
    },
  });

  return {
    user,
    week,
    metrics,
    report,
  };
}

function getSkipMessage(metrics: WeeklyMetrics) {
  if (!metrics.hasEnabledAssistants) {
    return "Weekly AI reports are skipped until at least one assistant is enabled.";
  }

  if (!metrics.meaningfulActivity) {
    return "Weekly AI reports are skipped when there is no meaningful activity for the week.";
  }

  return null;
}

async function writeReport({
  user,
  week,
  metrics,
  regeneratedAt,
}: {
  user: UserWithAssistants;
  week: { start: Date; end: Date };
  metrics: WeeklyMetrics;
  regeneratedAt?: Date | null;
}) {
  const aiMetrics = toAiWeeklyMetrics(metrics);
  const insight = await generateWeeklyReportInsight(aiMetrics);
  const data = {
    weekEnd: week.end,
    metricsJson: aiMetrics as unknown as Prisma.InputJsonValue,
    reportText: insight.text,
    model: insight.model,
    regeneratedAt,
  };

  return prisma.weeklyAiReport.upsert({
    where: {
      userId_weekStart: {
        userId: user.id,
        weekStart: week.start,
      },
    },
    create: {
      userId: user.id,
      weekStart: week.start,
      ...data,
    },
    update: data,
  });
}

export async function generateWeeklyAiReportForUser({
  userId,
  date = new Date(),
  force = false,
  manual = false,
}: {
  userId: string;
  date?: Date;
  force?: boolean;
  manual?: boolean;
}): Promise<WeeklyReportGenerationResult> {
  const state = await getCurrentWeeklyReportState(userId, manual ? new Date() : date);
  const skipMessage = getSkipMessage(state.metrics);

  if (skipMessage) {
    return {
      status: "skipped",
      report: state.report,
      metrics: state.metrics,
      message: skipMessage,
    };
  }

  if (!force && state.report) {
    return {
      status: "existing",
      report: state.report,
      metrics: state.metrics,
    };
  }

  if (manual && state.report?.regeneratedAt) {
    const nextAllowedAt = new Date(
      state.report.regeneratedAt.getTime() + MANUAL_REGENERATION_INTERVAL_MS,
    );

    if (nextAllowedAt.getTime() > Date.now()) {
      return {
        status: "rate-limited",
        report: state.report,
        metrics: state.metrics,
        message: `You can regenerate this report after ${formatReportDate(nextAllowedAt, state.week.timeZone)} ${new Intl.DateTimeFormat("en-GB", {
          timeZone: state.week.timeZone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(nextAllowedAt)}.`,
      };
    }
  }

  try {
    const report = await writeReport({
      user: state.user,
      week: state.week,
      metrics: state.metrics,
      regeneratedAt: manual ? new Date() : state.report?.regeneratedAt ?? null,
    });

    return {
      status: "stored",
      report,
      metrics: state.metrics,
    };
  } catch (error) {
    console.error("[weekly-ai-report] Failed to generate report.", error);

    return {
      status: "fallback",
      report: state.report,
      metrics: state.metrics,
      message: WEEKLY_REPORT_FALLBACK,
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateWeeklyAiReportsForDueUsers({
  date = new Date(),
  force = false,
  stagger = true,
}: {
  date?: Date;
  force?: boolean;
  stagger?: boolean;
} = {}) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { assistantHabits: true },
        { assistantExpenses: true },
        { assistantWeight: true },
      ],
    },
    select: {
      id: true,
    },
  });
  const results: Record<WeeklyReportGenerationResult["status"], number> = {
    stored: 0,
    existing: 0,
    skipped: 0,
    fallback: 0,
    "rate-limited": 0,
  };

  for (const user of users) {
    if (stagger) {
      await sleep(Math.floor(Math.random() * 30_000));
    }

    try {
      const result = await generateWeeklyAiReportForUser({
        userId: user.id,
        date,
        force,
      });

      results[result.status] += 1;
    } catch (error) {
      results.fallback += 1;
      console.error("[weekly-ai-report] Unexpected scheduled report error.", error);
    }
  }

  return {
    total: users.length,
    ...results,
  };
}

export async function generateSampleWeeklyAiReportForDevelopment({
  userId,
  date = new Date(),
}: {
  userId?: string;
  date?: Date;
} = {}): Promise<SampleWeeklyAiReportResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Sample weekly AI reports are disabled in production.");
  }

  const user = userId
    ? await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          currency: true,
        },
      })
    : await prisma.user.findFirst({
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          currency: true,
        },
      });
  const { week, metrics } = buildSampleAiWeeklyMetrics({
    currency: user?.currency ?? "GBP",
    date,
  });
  const insight = await generateWeeklyReportInsight(metrics);

  if (!user) {
    return {
      status: "printed",
      reportText: insight.text,
      model: insight.model,
    };
  }

  const report = await prisma.weeklyAiReport.upsert({
    where: {
      userId_weekStart: {
        userId: user.id,
        weekStart: week.start,
      },
    },
    create: {
      userId: user.id,
      weekStart: week.start,
      weekEnd: week.end,
      metricsJson: metrics as unknown as Prisma.InputJsonValue,
      reportText: insight.text,
      model: insight.model,
      regeneratedAt: new Date(),
    },
    update: {
      weekEnd: week.end,
      metricsJson: metrics as unknown as Prisma.InputJsonValue,
      reportText: insight.text,
      model: insight.model,
      regeneratedAt: new Date(),
    },
  });

  return {
    status: "stored",
    reportId: report.id,
    reportText: report.reportText,
    model: report.model,
    userId: user.id,
  };
}

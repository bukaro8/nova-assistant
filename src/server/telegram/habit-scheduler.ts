import "dotenv/config";

import { pathToFileURL } from "node:url";

import { prisma } from "../db/prisma";
import {
  generateSampleWeeklyAiReportForDevelopment,
  generateWeeklyAiReportsForDueUsers,
} from "../reports/weekly-ai-report";
import { requireHabitBotToken, sendTelegramMessage } from "./api";

const UK_TIME_ZONE = "Europe/London";
const MINUTE_MS = 60_000;
const WEEKLY_REPORT_DAY = "MON";
const WEEKLY_REPORT_TIME = "00:05";
const TELEGRAM_DEBUG = process.env.NOVA_TELEGRAM_DEBUG === "true";

type ReminderType = "initial" | "retry";

type UkClock = {
  dateKey: string;
  dayCode: string;
  time: string;
};

function debug(message: string, meta?: Record<string, unknown>) {
  if (!TELEGRAM_DEBUG) {
    return;
  }

  if (meta) {
    console.log(`[telegram:habit:scheduler] ${message}`, meta);
    return;
  }

  console.log(`[telegram:habit:scheduler] ${message}`);
}

function getCliValue(flag: string) {
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function getUkClock(date = new Date()): UkClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
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
    throw new Error("Failed to read current UK time.");
  }

  return {
    dateKey: `${year}-${month}-${day}`,
    dayCode: weekday.slice(0, 3).toUpperCase(),
    time: `${hour}:${minute}`,
  };
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  return { year, month, day };
}

function formatUkDateKey(date: Date) {
  return getUkClock(date).dateKey;
}

function getUtcForUkLocal(dateKey: string, time: string) {
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
  const ukClockAtAssumedUtc = getUkClock(assumedUtc);
  const formatted = parseDateKey(ukClockAtAssumedUtc.dateKey);
  const formattedUtcMinutes =
    Date.UTC(
      formatted.year,
      formatted.month - 1,
      formatted.day,
      Number(ukClockAtAssumedUtc.time.slice(0, 2)),
      Number(ukClockAtAssumedUtc.time.slice(3, 5)),
    ) / MINUTE_MS;
  const wantedUtcMinutes =
    Date.UTC(year, month - 1, day, hour, minute) / MINUTE_MS;
  const diffMinutes = wantedUtcMinutes - formattedUtcMinutes;

  return new Date(assumedUtc.getTime() + diffMinutes * MINUTE_MS);
}

function getUkDayRange(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  const start = getUtcForUkLocal(dateKey, "00:00");
  const nextDateKey = formatUkDateKey(
    new Date(Date.UTC(year, month - 1, day + 1, 12, 0)),
  );
  const end = getUtcForUkLocal(nextDateKey, "00:00");

  return { start, end };
}

function resolveClockForRun() {
  const now = getUkClock();
  const overrideTime = getCliValue("--time");
  const overrideDay = getCliValue("--day");

  return {
    ...now,
    time: overrideTime ?? now.time,
    dayCode: overrideDay?.toUpperCase() ?? now.dayCode,
  };
}

function shouldRunWeeklyReports(clock: UkClock) {
  if (process.argv.includes("--weekly-reports") || process.argv.includes("--weekly-reports-once")) {
    return true;
  }

  return clock.dayCode === WEEKLY_REPORT_DAY && clock.time === WEEKLY_REPORT_TIME;
}

function getReportDateForScheduledRun(clock: UkClock) {
  const runTime = getUtcForUkLocal(clock.dateKey, clock.time);

  return new Date(runTime.getTime() - 10 * 60_000);
}

function getDueReminderType(
  habit: { reminderTime: string; retryTimes: string[] },
  time: string,
): ReminderType | null {
  if (habit.reminderTime === time) {
    return "initial";
  }

  if (habit.retryTimes.includes(time)) {
    return "retry";
  }

  return null;
}

async function processDueReminders() {
  const clock = resolveClockForRun();
  const { start, end } = getUkDayRange(clock.dateKey);

  debug("Checking scheduled habits.", {
    dateKey: clock.dateKey,
    dayCode: clock.dayCode,
    time: clock.time,
    dayStartUtc: start,
    dayEndUtc: end,
  });

  const users = await prisma.user.findMany({
    include: {
      habits: {
        where: {
          active: true,
        },
      },
    },
  });

  const usersWithHabitChatId = users.filter((user) => user.telegramHabitChatId);

  debug("Users loaded for scheduler.", {
    userCount: users.length,
    usersWithTelegramHabitChatId: usersWithHabitChatId.length,
    users: users.map((user) => ({
      userId: user.id,
      email: user.email,
      hasTelegramHabitChatId: Boolean(user.telegramHabitChatId),
      activeHabitCount: user.habits.length,
    })),
  });

  for (const user of users) {
    debug("Active habits found for user.", {
      userId: user.id,
      email: user.email,
      hasTelegramHabitChatId: Boolean(user.telegramHabitChatId),
      activeHabitCount: user.habits.length,
      habits: user.habits.map((habit) => ({
        code: habit.code,
        reminderTime: habit.reminderTime,
        retryTimes: habit.retryTimes,
        scheduleDays: habit.scheduleDays,
      })),
    });

    if (!user.telegramHabitChatId) {
      debug("Skipping user because telegramHabitChatId is missing.", {
        userId: user.id,
        email: user.email,
      });
      continue;
    }

    for (const habit of user.habits) {
      const scheduleDayMatches = habit.scheduleDays.includes(clock.dayCode);
      const reminderTimeMatches = habit.reminderTime === clock.time;
      const retryTimeMatches = habit.retryTimes.includes(clock.time);

      debug("Evaluating habit schedule.", {
        userId: user.id,
        email: user.email,
        habitId: habit.id,
        code: habit.code,
        reminderTime: habit.reminderTime,
        retryTimes: habit.retryTimes,
        scheduleDays: habit.scheduleDays,
        currentDay: clock.dayCode,
        currentTime: clock.time,
        scheduleDayMatches,
        reminderTimeMatches,
        retryTimeMatches,
      });

      if (!scheduleDayMatches) {
        debug("Skipping habit because scheduleDays does not include current day.", {
          code: habit.code,
          scheduleDays: habit.scheduleDays,
          currentDay: clock.dayCode,
        });
        continue;
      }

      const reminderType = getDueReminderType(habit, clock.time);

      if (!reminderType) {
        debug("Skipping habit because current time does not match reminder or retry times.", {
          code: habit.code,
          reminderTime: habit.reminderTime,
          retryTimes: habit.retryTimes,
          currentTime: clock.time,
        });
        continue;
      }

      const scheduledTime = `${clock.dateKey} ${clock.time}`;
      const existingReminder = await prisma.reminderLog.findUnique({
        where: {
          userId_habitId_scheduledTime_type: {
            userId: user.id,
            habitId: habit.id,
            scheduledTime,
            type: reminderType,
          },
        },
      });

      debug("ReminderLog existing check result.", {
        code: habit.code,
        reminderType,
        scheduledTime,
        alreadySent: Boolean(existingReminder),
        reminderLogId: existingReminder?.id,
      });

      if (existingReminder) {
        console.log(
          `Skipped ${habit.code} ${reminderType}; already sent for ${scheduledTime}.`,
        );
        continue;
      }

      const existingCompletion = await prisma.habitLog.findFirst({
        where: {
          userId: user.id,
          habitId: habit.id,
          status: "DONE",
          loggedAt: {
            gte: start,
            lt: end,
          },
        },
      });

      debug("HabitLog DONE today check result.", {
        code: habit.code,
        reminderType,
        hasDoneToday: Boolean(existingCompletion),
        habitLogId: existingCompletion?.id,
        dayStartUtc: start,
        dayEndUtc: end,
      });

      if (existingCompletion) {
        console.log(
          `Skipped ${habit.code} ${reminderType}; already completed today.`,
        );
        continue;
      }

      debug("Attempting Telegram sendMessage.", {
        code: habit.code,
        reminderType,
        chatId: user.telegramHabitChatId,
        message: habit.reminderMessage,
      });

      let telegramMessage: Awaited<ReturnType<typeof sendTelegramMessage>>;

      try {
        telegramMessage = await sendTelegramMessage(
          user.telegramHabitChatId,
          habit.reminderMessage,
        );
      } catch (error) {
        console.error("[telegram:habit:scheduler] Telegram sendMessage error.", {
          code: habit.code,
          reminderType,
          error,
        });
        throw error;
      }

      debug("Telegram sendMessage response.", {
        code: habit.code,
        reminderType,
        response: telegramMessage,
      });

      const reminderLog = await prisma.reminderLog.create({
        data: {
          userId: user.id,
          habitId: habit.id,
          scheduledTime,
          type: reminderType,
        },
      });

      if (reminderType === "retry") {
        console.log(
          `Retry sent for ${habit.code} at ${scheduledTime}.`,
        );
      } else {
        console.log(
          `Reminder sent for ${habit.code} at ${scheduledTime}.`,
        );
      }

      debug("ReminderLog create result.", {
        reminderLogId: reminderLog.id,
        userId: reminderLog.userId,
        habitId: reminderLog.habitId,
        scheduledTime: reminderLog.scheduledTime,
        type: reminderLog.type,
        sentAt: reminderLog.sentAt,
      });
    }
  }
}

async function processDueWeeklyReports() {
  const clock = resolveClockForRun();

  if (!shouldRunWeeklyReports(clock)) {
    debug("Skipping weekly AI reports; not scheduled for this minute.", {
      dayCode: clock.dayCode,
      time: clock.time,
      scheduledDay: WEEKLY_REPORT_DAY,
      scheduledTime: WEEKLY_REPORT_TIME,
    });
    return;
  }

  debug("Generating weekly AI reports.", {
    dateKey: clock.dateKey,
    dayCode: clock.dayCode,
    time: clock.time,
    forced:
      process.argv.includes("--weekly-reports") ||
      process.argv.includes("--weekly-reports-once"),
  });

  const results = await generateWeeklyAiReportsForDueUsers({
    date:
      process.argv.includes("--weekly-reports") ||
      process.argv.includes("--weekly-reports-once")
        ? new Date()
        : getReportDateForScheduledRun(clock),
  });

  debug("Weekly AI report generation finished.", {
    results,
  });
}

async function processSampleWeeklyReport() {
  const result = await generateSampleWeeklyAiReportForDevelopment({
    userId: getCliValue("--user-id"),
  });

  if (result.status === "stored") {
    console.log(
      `Sample weekly AI report stored for local user ${result.userId} as ${result.reportId}.`,
    );
  } else {
    console.log("Sample weekly AI report generated without a local user.");
  }

  console.log("");
  console.log(result.reportText);
}

async function processScheduledWork() {
  await processDueReminders();
  await processDueWeeklyReports();
}

function msUntilNextMinute() {
  const now = new Date();
  return MINUTE_MS - (now.getSeconds() * 1000 + now.getMilliseconds());
}

export async function startHabitScheduler() {
  requireHabitBotToken();

  debug("Scheduler started.", {
    timeZone: UK_TIME_ZONE,
    interval: "every minute",
    weeklyReportSchedule: `${WEEKLY_REPORT_DAY} ${WEEKLY_REPORT_TIME}`,
  });

  await processScheduledWork();

  setTimeout(() => {
    void processScheduledWork().catch((error) => {
      console.error("[telegram:habit:scheduler] Caught scheduler error.", error);
    });

    setInterval(() => {
      void processScheduledWork().catch((error) => {
        console.error(
          "[telegram:habit:scheduler] Caught scheduler error.",
          error,
        );
      });
    }, MINUTE_MS);
  }, msUntilNextMinute());
}

function isMainModule() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false;
}

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

if (isMainModule()) {
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  if (process.argv.includes("--weekly-reports-sample")) {
    processSampleWeeklyReport()
      .catch((error) => {
        console.error("[telegram:habit:scheduler] Caught error.", error);
        process.exit(1);
      })
      .finally(async () => {
        await prisma.$disconnect();
      });
  } else if (process.argv.includes("--weekly-reports-once")) {
    processDueWeeklyReports()
      .catch((error) => {
        console.error("[telegram:habit:scheduler] Caught error.", error);
        process.exit(1);
      })
      .finally(async () => {
        await prisma.$disconnect();
      });
  } else if (process.argv.includes("--once")) {
    processScheduledWork()
      .catch((error) => {
        console.error("[telegram:habit:scheduler] Caught error.", error);
        process.exit(1);
      })
      .finally(async () => {
        await prisma.$disconnect();
      });
  } else {
    startHabitScheduler().catch(async (error) => {
      console.error("[telegram:habit:scheduler] Caught error.", error);
      await prisma.$disconnect();
      process.exit(1);
    });
  }
}

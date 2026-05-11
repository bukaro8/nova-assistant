import { getUkClock, type UkDay } from "@/server/dashboard/date-utils";

const DAY_MS = 86_400_000;
const WEEK_DAYS: UkDay[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

type HabitForStats = {
  id: string;
  scheduleDays: string[];
};

type HabitLogForStats = {
  habitId: string;
  loggedAt: Date;
};

type WeekDayForStats = {
  dateKey: string;
  dayCode: UkDay;
};

function dateKeyToMiddayUtc(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function addDays(dateKey: string, days: number) {
  return getUkClock(
    new Date(dateKeyToMiddayUtc(dateKey).getTime() + days * DAY_MS),
  ).dateKey;
}

function compareDateKeys(a: string, b: string) {
  return a.localeCompare(b);
}

function getPreviousDateKey(dateKey: string) {
  return addDays(dateKey, -1);
}

function getFirstScheduledDateOnOrBefore(habit: HabitForStats, dateKey: string) {
  let cursor = dateKey;

  for (let index = 0; index < 14; index += 1) {
    const day = getUkClock(dateKeyToMiddayUtc(cursor)).dayCode;

    if (habit.scheduleDays.includes(day)) {
      return cursor;
    }

    cursor = getPreviousDateKey(cursor);
  }

  return dateKey;
}

function getDoneDateKeys(logs: HabitLogForStats[]) {
  return new Set(logs.map((log) => getUkClock(log.loggedAt).dateKey));
}

function getScheduledDateKeysBetween({
  habit,
  startDateKey,
  endDateKey,
}: {
  habit: HabitForStats;
  startDateKey: string;
  endDateKey: string;
}) {
  const keys: string[] = [];
  let cursor = startDateKey;

  while (compareDateKeys(cursor, endDateKey) <= 0) {
    const day = getUkClock(dateKeyToMiddayUtc(cursor)).dayCode;

    if (habit.scheduleDays.includes(day)) {
      keys.push(cursor);
    }

    cursor = addDays(cursor, 1);
  }

  return keys;
}

export function getHabitStats({
  habit,
  logs,
  weekDays,
  todayDateKey,
}: {
  habit: HabitForStats;
  logs: HabitLogForStats[];
  weekDays: WeekDayForStats[];
  todayDateKey: string;
}) {
  if (habit.scheduleDays.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      weeklyCompletedCount: 0,
      weeklyTotal: 0,
      weeklyPercentage: 0,
      perfectWeekSoFar: false,
      scheduledToday: false,
    };
  }

  const habitLogs = logs.filter((log) => log.habitId === habit.id);
  const doneKeys = getDoneDateKeys(habitLogs);
  const scheduledThisWeek = weekDays.filter((day) =>
    habit.scheduleDays.includes(day.dayCode),
  );
  const weeklyCompletedCount = scheduledThisWeek.filter((day) =>
    doneKeys.has(day.dateKey),
  ).length;
  const weeklyTotal = scheduledThisWeek.length;
  const weeklyPercentage =
    weeklyTotal === 0 ? 0 : Math.round((weeklyCompletedCount / weeklyTotal) * 100);
  const latestScheduledDateKey = getFirstScheduledDateOnOrBefore(
    habit,
    todayDateKey,
  );
  let currentStreak = 0;
  let cursor = latestScheduledDateKey;

  while (true) {
    const day = getUkClock(dateKeyToMiddayUtc(cursor)).dayCode;

    if (!habit.scheduleDays.includes(day)) {
      cursor = getPreviousDateKey(cursor);
      continue;
    }

    if (!doneKeys.has(cursor)) {
      break;
    }

    currentStreak += 1;
    cursor = getPreviousDateKey(cursor);
  }

  const firstDoneDateKey = Array.from(doneKeys).sort(compareDateKeys)[0];
  const scheduledHistory = firstDoneDateKey
    ? getScheduledDateKeysBetween({
        habit,
        startDateKey: firstDoneDateKey,
        endDateKey: todayDateKey,
      })
    : [];
  let longestStreak = 0;
  let runningStreak = 0;

  for (const dateKey of scheduledHistory) {
    if (doneKeys.has(dateKey)) {
      runningStreak += 1;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  }

  const elapsedScheduledThisWeek = scheduledThisWeek.filter(
    (day) => compareDateKeys(day.dateKey, todayDateKey) <= 0,
  );
  const elapsedCompletedCount = elapsedScheduledThisWeek.filter((day) =>
    doneKeys.has(day.dateKey),
  ).length;
  const perfectWeekSoFar =
    elapsedScheduledThisWeek.length > 0 &&
    elapsedCompletedCount === elapsedScheduledThisWeek.length;

  return {
    currentStreak,
    longestStreak,
    weeklyCompletedCount,
    weeklyTotal,
    weeklyPercentage,
    perfectWeekSoFar,
    scheduledToday: habit.scheduleDays.includes(
      getUkClock(dateKeyToMiddayUtc(todayDateKey)).dayCode,
    ),
  };
}

export function formatStreak(streak: number) {
  return streak > 0 ? `🔥 ${streak} ${streak === 1 ? "day" : "days"}` : "No streak yet";
}

export function formatWeeklyProgress(completed: number, total: number) {
  return total > 0 ? `${completed}/${total}` : "Not scheduled";
}

export { WEEK_DAYS };

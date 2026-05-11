const UK_TIME_ZONE = "Europe/London";
const DAY_MS = 86_400_000;

export type UkDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

type UkClock = {
  dateKey: string;
  dayCode: UkDay;
};

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  return { year, month, day };
}

export function getUkClock(date = new Date()): UkClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  const weekday = value("weekday");
  const year = value("year");
  const month = value("month");
  const day = value("day");

  if (!weekday || !year || !month || !day) {
    throw new Error("Failed to read UK date.");
  }

  return {
    dateKey: `${year}-${month}-${day}`,
    dayCode: weekday.slice(0, 3).toUpperCase() as UkDay,
  };
}

export function formatUkDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatShortUkDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function getUtcForUkDateInput(dateInput: string) {
  return getUtcForUkLocal(dateInput, "12:00");
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
  const ukClockAtAssumedUtc = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(assumedUtc);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    ukClockAtAssumedUtc.find((part) => part.type === type)?.value;
  const formattedDateKey = `${value("year")}-${value("month")}-${value("day")}`;
  const formatted = parseDateKey(formattedDateKey);
  const formattedUtcMinutes =
    Date.UTC(
      formatted.year,
      formatted.month - 1,
      formatted.day,
      Number(value("hour")),
      Number(value("minute")),
    ) / 60_000;
  const wantedUtcMinutes =
    Date.UTC(year, month - 1, day, hour, minute) / 60_000;

  return new Date(
    assumedUtc.getTime() + (wantedUtcMinutes - formattedUtcMinutes) * 60_000,
  );
}

export function getUkDayRange(date = new Date()) {
  const dateKey = getUkClock(date).dateKey;
  const { year, month, day } = parseDateKey(dateKey);
  const start = getUtcForUkLocal(dateKey, "00:00");
  const nextDateKey = getUkClock(
    new Date(Date.UTC(year, month - 1, day + 1, 12)),
  ).dateKey;
  const end = getUtcForUkLocal(nextDateKey, "00:00");

  return { start, end, dateKey };
}

export function getCurrentUkWeekRange(date = new Date()) {
  const today = getUkClock(date);
  const order: UkDay[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const dayOffset = order.indexOf(today.dayCode);
  const middayToday = new Date(`${today.dateKey}T12:00:00.000Z`);
  const mondayDateKey = getUkClock(
    new Date(middayToday.getTime() - dayOffset * DAY_MS),
  ).dateKey;
  const sundayDateKey = getUkClock(
    new Date(middayToday.getTime() + (6 - dayOffset) * DAY_MS),
  ).dateKey;
  const start = getUtcForUkLocal(mondayDateKey, "00:00");
  const sunday = parseDateKey(sundayDateKey);
  const afterSundayDateKey = getUkClock(
    new Date(Date.UTC(sunday.year, sunday.month - 1, sunday.day + 1, 12)),
  ).dateKey;
  const end = getUtcForUkLocal(afterSundayDateKey, "00:00");

  return { start, end, mondayDateKey };
}

export function getWeekChartDays(start: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    return {
      key: getUkClock(new Date(date.getTime() + 12 * 60 * 60 * 1000)).dateKey,
      label: new Intl.DateTimeFormat("en-GB", {
        timeZone: UK_TIME_ZONE,
        weekday: "short",
      }).format(date),
      total: 0,
    };
  });
}

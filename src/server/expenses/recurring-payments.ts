import {
  getUkClock,
  getUtcForUkDateInput,
} from "@/server/dashboard/date-utils";

const MAX_DUE_PAYMENTS_PER_RUN = 100;

type RecurringPaymentRecord = {
  id: string;
  userId: string;
  name: string;
  amount: unknown;
  category: string;
  dayOfMonth: number;
  nextRunAt: Date;
  isActive: boolean;
};

type RecurringPaymentProcessorClient = {
  recurringPayment: {
    findMany(args: unknown): Promise<RecurringPaymentRecord[]>;
    update(args: unknown): Promise<unknown>;
  };
  expense: {
    create(args: unknown): Promise<unknown>;
  };
};

export type RecurringPaymentRunResult = {
  processed: number;
  generated: number;
  skipped: number;
  failed: number;
};

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  return { year, month, day };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

function monthDateKey(year: number, month: number, dayOfMonth: number) {
  const clampedDay = Math.min(dayOfMonth, daysInMonth(year, month));

  return `${year}-${String(month).padStart(2, "0")}-${String(
    clampedDay,
  ).padStart(2, "0")}`;
}

function addOneMonth(year: number, month: number) {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }

  return { year, month: month + 1 };
}

export function getRecurringPaymentMonthKey(runAt: Date) {
  return getUkClock(runAt).dateKey.slice(0, 7);
}

export function getInitialMonthlyRunAt(dayOfMonth: number, now = new Date()) {
  const today = parseDateKey(getUkClock(now).dateKey);
  const thisMonthRun = getUtcForUkDateInput(
    monthDateKey(today.year, today.month, dayOfMonth),
  );

  if (thisMonthRun.getTime() >= now.getTime()) {
    return thisMonthRun;
  }

  const next = addOneMonth(today.year, today.month);

  return getUtcForUkDateInput(monthDateKey(next.year, next.month, dayOfMonth));
}

export function getNextMonthlyRunAt(dayOfMonth: number, previousRunAt: Date) {
  const previous = parseDateKey(getUkClock(previousRunAt).dateKey);
  const next = addOneMonth(previous.year, previous.month);

  return getUtcForUkDateInput(monthDateKey(next.year, next.month, dayOfMonth));
}

export async function processDueRecurringPayments({
  now = new Date(),
  db,
}: {
  now?: Date;
  db?: RecurringPaymentProcessorClient;
} = {}): Promise<RecurringPaymentRunResult> {
  const client =
    db ??
    ((await import("@/server/db/prisma")).prisma as unknown as RecurringPaymentProcessorClient);
  const duePayments = await client.recurringPayment.findMany({
    where: {
      isActive: true,
      nextRunAt: {
        lte: now,
      },
    },
    orderBy: {
      nextRunAt: "asc",
    },
    take: MAX_DUE_PAYMENTS_PER_RUN,
  });

  const result: RecurringPaymentRunResult = {
    processed: duePayments.length,
    generated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const payment of duePayments) {
    if (!payment.isActive || payment.nextRunAt.getTime() > now.getTime()) {
      result.skipped += 1;
      continue;
    }

    const recurringForMonth = getRecurringPaymentMonthKey(payment.nextRunAt);
    const nextRunAt = getNextMonthlyRunAt(
      payment.dayOfMonth,
      payment.nextRunAt,
    );

    try {
      await client.expense.create({
        data: {
          userId: payment.userId,
          amount: payment.amount,
          description: payment.name,
          rawText: payment.name,
          category: payment.category,
          confidence: 1,
          source: "recurring",
          createdVia: "recurring",
          expenseDate: payment.nextRunAt,
          recurringPaymentId: payment.id,
          recurringForMonth,
        },
      });
      result.generated += 1;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        result.skipped += 1;
      } else {
        result.failed += 1;
        continue;
      }
    }

    await client.recurringPayment.update({
      where: {
        id: payment.id,
      },
      data: {
        nextRunAt,
      },
    });
  }

  return result;
}

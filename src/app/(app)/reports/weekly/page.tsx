import Link from "next/link";
import { Fragment } from "react";
import { ArrowLeft, BarChart3 } from "lucide-react";

import {
  AccountSpendingChart,
  CashDebtTrendChart,
  CategoryTrendChart,
  SpendingIncomeChart,
  WeightReportChart,
} from "@/components/report-analytics-charts";
import { HabitToast } from "@/components/habit-manage-controls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AccountType, ExpenseCategory } from "@/generated/prisma/enums";
import { formatCurrency } from "@/lib/currency";
import { calculateAccountBalance } from "@/server/accounts/accounts";
import {
  formatShortUkDate,
  getCurrentUkWeekRange,
  getUkClock,
  getUkDayRange,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

const periodOptions = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "3m", label: "3 months", days: 90 },
  { value: "6m", label: "6 months", days: 180 },
  { value: "1y", label: "1 year", days: 365 },
] as const;

type SearchParams = Promise<{
  period?: string;
}>;

type WeekBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

type ReportCategory =
  | "groceries"
  | "food"
  | "shopping"
  | "transport"
  | "bills"
  | "subscriptions"
  | "other";

function getPeriod(value: string | undefined) {
  return (
    periodOptions.find((option) => option.value === value) ??
    periodOptions.find((option) => option.value === "30d")!
  );
}

function isSpendingExpense(expense: {
  amount: unknown;
  category: string | null;
}) {
  return (
    Number(expense.amount) > 0 &&
    expense.category !== ExpenseCategory.INCOME &&
    expense.category !== ExpenseCategory.TRANSFER
  );
}

function incomeAmount(expense: {
  amount: unknown;
  category: string | null;
}) {
  const amount = Number(expense.amount);

  if (expense.category === ExpenseCategory.INCOME) {
    return Math.abs(amount);
  }

  if (amount < 0 && expense.category !== ExpenseCategory.TRANSFER) {
    return Math.abs(amount);
  }

  return 0;
}

function reportCategory(category: string | null): ReportCategory {
  if (category === ExpenseCategory.GROCERIES) {
    return "groceries";
  }

  if (
    category === ExpenseCategory.TAKEAWAY ||
    category === ExpenseCategory.COFFEE_SNACKS
  ) {
    return "food";
  }

  if (category === ExpenseCategory.SHOPPING) {
    return "shopping";
  }

  if (category === ExpenseCategory.TRANSPORT) {
    return "transport";
  }

  if (
    category === ExpenseCategory.HOUSING_BILLS ||
    category === ExpenseCategory.HOUSEHOLD ||
    category === ExpenseCategory.INSURANCE
  ) {
    return "bills";
  }

  if (category === ExpenseCategory.SUBSCRIPTIONS) {
    return "subscriptions";
  }

  return "other";
}

function buildWeekBuckets(start: Date, end: Date): WeekBucket[] {
  const buckets = new Map<string, WeekBucket>();

  for (
    let cursor = new Date(start.getTime());
    cursor < end;
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    const week = getCurrentUkWeekRange(cursor);

    if (!buckets.has(week.mondayDateKey)) {
      buckets.set(week.mondayDateKey, {
        key: week.mondayDateKey,
        label: formatShortUkDate(week.start),
        start: week.start,
        end: week.end,
      });
    }
  }

  return Array.from(buckets.values()).sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}

function buildPeriodDays(start: Date, end: Date) {
  const days = [];

  for (
    let cursor = new Date(start.getTime());
    cursor < end;
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    const clock = getUkClock(new Date(cursor.getTime() + 12 * 60 * 60 * 1000));
    days.push({
      key: clock.dateKey,
      label: new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        weekday: "short",
      }).format(cursor),
      shortDate: clock.dateKey.slice(-2),
    });
  }

  return days;
}

function emptyCategoryPoint(label: string) {
  return {
    label,
    groceries: 0,
    food: 0,
    shopping: 0,
    transport: 0,
    bills: 0,
    subscriptions: 0,
    other: 0,
  };
}

function rollingAverage(values: number[], index: number, windowSize = 3) {
  const start = Math.max(0, index - windowSize + 1);
  const window = values.slice(start, index + 1);

  return window.reduce((total, value) => total + value, 0) / window.length;
}

export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const selectedPeriod = getPeriod(params.period);
  const user = await requireCurrentUser();
  const todayRange = getUkDayRange();
  const periodStartSeed = new Date(
    todayRange.start.getTime() - (selectedPeriod.days - 1) * DAY_MS,
  );
  const periodStart = getUkDayRange(periodStartSeed).start;
  const periodEnd = todayRange.end;
  const weekBuckets = buildWeekBuckets(periodStart, periodEnd);
  const periodDays = buildPeriodDays(periodStart, periodEnd);

  const [expenses, accounts, accountExpenses, habits, habitLogs, weightLogs] =
    await Promise.all([
      prisma.expense.findMany({
        where: {
          userId: user.id,
          expenseDate: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
        include: {
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          expenseDate: "asc",
        },
      }),
      prisma.account.findMany({
        where: {
          userId: user.id,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          type: true,
          openingBalance: true,
        },
      }),
      prisma.expense.findMany({
        where: {
          userId: user.id,
          expenseDate: {
            lt: periodEnd,
          },
        },
        select: {
          accountId: true,
          amount: true,
          category: true,
          expenseDate: true,
        },
        orderBy: {
          expenseDate: "asc",
        },
      }),
      prisma.habit.findMany({
        where: {
          userId: user.id,
          active: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.habitLog.findMany({
        where: {
          userId: user.id,
          status: "DONE",
          loggedAt: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
        select: {
          habitId: true,
          loggedAt: true,
        },
      }),
      prisma.weightLog.findMany({
        where: {
          userId: user.id,
          createdAt: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

  const spendingIncomeData = weekBuckets.map((bucket) => ({
    label: bucket.label,
    spending: 0,
    income: 0,
  }));
  const categoryTrendData = weekBuckets.map((bucket) =>
    emptyCategoryPoint(bucket.label),
  );
  const spendingByAccount = new Map<string, { account: string; total: number }>();
  const bucketIndexByKey = new Map(
    weekBuckets.map((bucket, index) => [bucket.key, index]),
  );

  for (const expense of expenses) {
    const weekKey = getCurrentUkWeekRange(expense.expenseDate).mondayDateKey;
    const bucketIndex = bucketIndexByKey.get(weekKey);

    if (bucketIndex === undefined) {
      continue;
    }

    if (isSpendingExpense(expense)) {
      const amount = Number(expense.amount);
      const category = reportCategory(expense.category);
      const accountKey = expense.accountId ?? "no-account";
      const accountName = expense.account?.name ?? "No account";
      const accountTotal = spendingByAccount.get(accountKey) ?? {
        account: accountName,
        total: 0,
      };

      spendingIncomeData[bucketIndex].spending += amount;
      categoryTrendData[bucketIndex][category] += amount;
      accountTotal.total += amount;
      spendingByAccount.set(accountKey, accountTotal);
      continue;
    }

    const income = incomeAmount(expense);

    if (income > 0) {
      spendingIncomeData[bucketIndex].income += income;
    }
  }

  const accountSpendingData = Array.from(spendingByAccount.values()).sort(
    (a, b) => b.total - a.total,
  );
  const cashDebtData = weekBuckets.map((bucket) => {
    let availableMoney = 0;
    let creditCardDebt = 0;

    for (const account of accounts) {
      const balance = calculateAccountBalance({
        openingBalance: account.openingBalance,
        entries: accountExpenses
          .filter(
            (expense) =>
              expense.accountId === account.id && expense.expenseDate < bucket.end,
          )
          .map((expense) => ({
            amount: expense.amount,
            category: expense.category,
          })),
      });

      if (account.type === AccountType.CREDIT_CARD) {
        creditCardDebt += balance < 0 ? Math.abs(balance) : 0;
      } else {
        availableMoney += balance;
      }
    }

    return {
      label: bucket.label,
      availableMoney,
      creditCardDebt,
      netPosition: availableMoney - creditCardDebt,
    };
  });
  const habitDoneKeys = new Set(
    habitLogs.map((log) => `${log.habitId}:${getUkClock(log.loggedAt).dateKey}`),
  );
  const weightValues = weightLogs.map((log) => Number(log.weight));
  const weightTrendData = weightLogs.map((log, index) => ({
    label: formatShortUkDate(log.createdAt),
    weight: Number(log.weight),
    rollingAverage: rollingAverage(weightValues, index),
  }));
  const totalSpending = expenses
    .filter(isSpendingExpense)
    .reduce((total, expense) => total + Number(expense.amount), 0);
  const totalIncome = expenses.reduce(
    (total, expense) => total + incomeAmount(expense),
    0,
  );
  const currentNetPosition = cashDebtData.at(-1)?.netPosition ?? 0;

  return (
    <div className="space-y-5">
      <HabitToast />
      <header className="space-y-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Analytics</p>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        </div>
      </header>

      <section className="grid grid-cols-5 gap-2">
        {periodOptions.map((option) => (
          <Link
            key={option.value}
            href={`/reports/weekly?period=${option.value}`}
            className={`flex h-11 items-center justify-center rounded-2xl border px-2 text-center text-xs font-medium sm:text-sm ${
              selectedPeriod.value === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </section>

      <section className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Spending</div>
          <div className="mt-1 text-lg font-semibold">
            {formatCurrency(totalSpending, user.currency)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Income</div>
          <div className="mt-1 text-lg font-semibold text-emerald-600">
            {formatCurrency(totalIncome, user.currency)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Net position</div>
          <div
            className={`mt-1 text-lg font-semibold ${
              currentNetPosition < 0 ? "text-destructive" : "text-emerald-600"
            }`}
          >
            {formatCurrency(currentNetPosition, user.currency)}
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            Spending vs income
          </CardTitle>
          <CardDescription>
            Weekly bars, excluding transfers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SpendingIncomeChart
            currency={user.currency}
            data={spendingIncomeData}
          />
        </CardContent>
      </Card>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cash vs debt trend</CardTitle>
            <CardDescription>Available money, card debt and net position.</CardDescription>
          </CardHeader>
          <CardContent>
            <CashDebtTrendChart
              currency={user.currency}
              data={cashDebtData}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Net position trend</CardTitle>
            <CardDescription>Available money minus card debt.</CardDescription>
          </CardHeader>
          <CardContent>
            <CashDebtTrendChart
              currency={user.currency}
              data={cashDebtData}
              showAvailable={false}
              showDebt={false}
              showNet
            />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Spending by category trend</CardTitle>
          <CardDescription>Weekly stacked spending, excluding income and transfers.</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryTrendChart
            currency={user.currency}
            data={categoryTrendData}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spending by account</CardTitle>
          <CardDescription>Period spending by card, bank account or cash.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountSpendingChart
            currency={user.currency}
            data={accountSpendingData}
          />
        </CardContent>
      </Card>

      {user.assistantHabits ? (
        <Card>
          <CardHeader>
            <CardTitle>Habit consistency</CardTitle>
            <CardDescription>Green means completed on that day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {habits.length > 0 ? (
              <div className="overflow-x-auto pb-2">
                <div
                  className="grid min-w-max gap-2"
                  style={{
                    gridTemplateColumns: `140px repeat(${periodDays.length}, 1.5rem)`,
                  }}
                >
                  <div />
                  {periodDays.map((day) => (
                    <div
                      key={day.key}
                      className="text-center text-[0.65rem] text-muted-foreground"
                    >
                      <div>{day.label.slice(0, 1)}</div>
                      <div>{day.shortDate}</div>
                    </div>
                  ))}
                  {habits.map((habit) => (
                    <Fragment key={habit.id}>
                      <div className="truncate pr-2 text-sm font-medium">
                        {habit.name}
                      </div>
                      {periodDays.map((day) => {
                        const done = habitDoneKeys.has(`${habit.id}:${day.key}`);
                        const scheduled = habit.scheduleDays.includes(
                          getUkClock(new Date(`${day.key}T12:00:00.000Z`)).dayCode,
                        );

                        return (
                          <div
                            key={`${habit.id}-${day.key}`}
                            className={`size-5 rounded-md ${
                              done
                                ? "bg-emerald-500"
                                : scheduled
                                  ? "bg-muted"
                                  : "bg-background"
                            }`}
                            title={`${habit.name} ${day.key}`}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No active habits in this period.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {user.assistantWeight && weightLogs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Weight trend</CardTitle>
            <CardDescription>Weight with a simple rolling average.</CardDescription>
          </CardHeader>
          <CardContent>
            <WeightReportChart data={weightTrendData} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

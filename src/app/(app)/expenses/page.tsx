import Link from "next/link";

import { AssistantDisabledCard } from "@/components/assistant-disabled-card";
import { CategoryBreakdownChart } from "@/components/category-breakdown-chart";
import { HabitToast } from "@/components/habit-manage-controls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WeeklySpendingChart } from "@/components/weekly-spending-chart";
import { ExpenseCategory } from "@/generated/prisma/enums";
import { formatCurrency } from "@/lib/currency";
import {
  createExpense,
  deleteExpense,
  updateExpense,
} from "@/server/dashboard/actions";
import {
  formatUkDate,
  getCurrentUkMonthRange,
  getCurrentUkWeekRange,
  getUkClock,
  getWeekChartDays,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import { getExpenseCategoryLabel } from "@/server/expenses/categorise-expense";
import { getActiveAccountsForUser } from "@/server/accounts/accounts";

export const dynamic = "force-dynamic";

type ExpenseFilter = "week" | "month" | "all";
type SearchParams = Promise<{
  filter?: string;
  account?: string;
}>;

const categories = Object.values(ExpenseCategory);

function getFilter(value: string | undefined): ExpenseFilter {
  if (value === "month" || value === "all") {
    return value;
  }

  return "week";
}

function totalSpend(
  expenses: Array<{
    amount: unknown;
  }>,
) {
  return expenses
    .filter((expense) => Number(expense.amount) > 0)
    .reduce((total, expense) => total + Number(expense.amount), 0);
}

function buildCategoryData(
  expenses: Array<{
    amount: unknown;
    category: string | null;
  }>,
) {
  const totals = new Map<string, number>();

  for (const expense of expenses) {
    const amount = Number(expense.amount);

    if (amount <= 0) {
      continue;
    }

    const category = getExpenseCategoryLabel(expense.category);
    totals.set(category, (totals.get(category) ?? 0) + amount);
  }

  return Array.from(totals.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

function dateInputValue(date: Date) {
  return getUkClock(date).dateKey;
}

function ExpenseForm({
  action,
  submitLabel,
  accounts,
  defaultAccountId,
  expense,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  accounts: Array<{
    id: string;
    name: string;
    isDefault: boolean;
  }>;
  defaultAccountId: string;
  expense?: {
    amount: unknown;
    description: string;
    category: string | null;
    accountId: string | null;
    expenseDate: Date;
  };
}) {
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Amount
          <input
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            name="amount"
            type="number"
            step="0.01"
            required
            defaultValue={
              expense ? Number(expense.amount).toFixed(2) : undefined
            }
            placeholder="15.48"
          />
        </label>
        <label className="text-sm font-medium">
          Category
          <select
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            name="category"
            defaultValue={expense?.category ?? ""}
          >
            <option value="">Auto categorise</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {getExpenseCategoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">
        Account
        <select
          className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          name="accountId"
          defaultValue={expense?.accountId ?? defaultAccountId}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Description
        <input
          className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          name="description"
          required
          defaultValue={expense?.description}
          placeholder="Aldi"
        />
      </label>
      <label className="block text-sm font-medium">
        Date
        <input
          className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          name="date"
          type="date"
          defaultValue={
            expense ? dateInputValue(expense.expenseDate) : undefined
          }
        />
      </label>
      <Button className="h-11 w-full rounded-2xl" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filter = getFilter(params.filter);
  const user = await requireCurrentUser();

  if (!user.assistantExpenses) {
    return (
      <AssistantDisabledCard
        title="Expense assistant is disabled"
        description="Enable expense tracking when you want NOVA to track spending and categories."
      />
    );
  }

  const week = getCurrentUkWeekRange();
  const month = getCurrentUkMonthRange();
  const accounts = await getActiveAccountsForUser(user.id);
  const defaultAccount = accounts.find((account) => account.isDefault) ?? accounts[0];
  const accountFilter = params.account ?? "all";
  const accountWhere =
    accountFilter === "unassigned"
      ? {
          accountId: null,
        }
      : accounts.some((account) => account.id === accountFilter)
        ? {
            accountId: accountFilter,
          }
        : {};
  const filterRange =
    filter === "week"
      ? { gte: week.start, lt: week.end }
      : filter === "month"
        ? { gte: month.start, lt: month.end }
        : undefined;

  const [filteredExpenses, weekExpenses, monthExpenses] = await Promise.all([
    prisma.expense.findMany({
      where: {
        userId: user.id,
        ...(filterRange
          ? {
              expenseDate: filterRange,
            }
          : {}),
        ...accountWhere,
      },
      include: {
        account: true,
      },
      orderBy: {
        expenseDate: "desc",
      },
      take: filter === "all" ? 100 : undefined,
    }),
    prisma.expense.findMany({
      where: {
        userId: user.id,
        expenseDate: {
          gte: week.start,
          lt: week.end,
        },
      },
      orderBy: {
        expenseDate: "asc",
      },
    }),
    prisma.expense.findMany({
      where: {
        userId: user.id,
        expenseDate: {
          gte: month.start,
          lt: month.end,
        },
      },
    }),
  ]);

  const weeklyTotal = totalSpend(weekExpenses);
  const monthlyTotal = totalSpend(monthExpenses);
  const filteredTotal = totalSpend(filteredExpenses);
  const categoryData = buildCategoryData(filteredExpenses);
  const biggestCategory = categoryData[0];
  const chartData = getWeekChartDays(week.start);

  for (const expense of weekExpenses) {
    const amount = Number(expense.amount);

    if (amount <= 0) {
      continue;
    }

    const key = getUkClock(expense.expenseDate).dateKey;
    const point = chartData.find((day) => day.key === key);

    if (point) {
      point.total += amount;
    }
  }

  return (
    <div className="space-y-5">
      <HabitToast />
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Spending reports</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/reports/weekly"
              className="flex h-10 items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              Weekly report
            </Link>
            <Link
              href="/expenses/recurring"
              className="flex h-10 items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              Recurring
            </Link>
            <Link
              href="/expenses/categories"
              className="flex h-10 items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              Category keywords
            </Link>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-2">
        {[
          ["week", "This week"],
          ["month", "This month"],
          ["all", "All time"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/expenses?filter=${value}`}
            className={`flex h-11 items-center justify-center rounded-2xl border px-2 text-center text-sm font-medium ${
              filter === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </section>

      <section className="grid gap-2 sm:grid-cols-4">
        {[
          ["all", "All accounts"],
          ...accounts.map((account) => [account.id, account.name]),
          ["unassigned", "Unassigned"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/expenses?filter=${filter}&account=${value}`}
            className={`flex h-11 items-center justify-center rounded-2xl border px-2 text-center text-sm font-medium ${
              accountFilter === value ||
              (accountFilter !== "unassigned" &&
                accountFilter !== "all" &&
                value === "all" &&
                !accounts.some((account) => account.id === accountFilter))
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>This week</CardTitle>
            <CardDescription>This week</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {formatCurrency(weeklyTotal, user.currency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>This month</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {formatCurrency(monthlyTotal, user.currency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>Selected period</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {filteredExpenses.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Biggest category</CardTitle>
            <CardDescription>Selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {biggestCategory ? (
              <div className="space-y-1">
                <div className="text-2xl font-semibold">
                  {biggestCategory.category}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(biggestCategory.total, user.currency)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No spending yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Add expense</CardTitle>
          <CardDescription>Manual entry for non-Telegram expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            accounts={accounts}
            action={createExpense}
            defaultAccountId={defaultAccount.id}
            submitLabel="Save expense"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily spending</CardTitle>
          <CardDescription>Current week</CardDescription>
        </CardHeader>
        <CardContent>
          <WeeklySpendingChart data={chartData} currency={user.currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category breakdown</CardTitle>
          <CardDescription>
            {formatCurrency(filteredTotal, user.currency)} in selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryBreakdownChart
            data={categoryData}
            currency={user.currency}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Latest expenses</h2>
          <p className="text-sm text-muted-foreground">
            Showing {filter === "all" ? "latest 100" : "selected period"}
          </p>
        </div>

        {filteredExpenses.length === 0 ? (
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground">
              No expenses recorded for this period.
            </CardContent>
          </Card>
        ) : (
          filteredExpenses.map((expense) => {
            const updateAction = updateExpense.bind(null, expense.id);
            const deleteAction = deleteExpense.bind(null, expense.id);

            return (
              <Card key={expense.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="truncate">
                      {expense.description}
                    </CardTitle>
                    <CardDescription>
                      {getExpenseCategoryLabel(expense.category)} ·{" "}
                      {expense.account?.name ?? "Unassigned"} ·{" "}
                      {formatUkDate(expense.expenseDate)}
                    </CardDescription>
                  </div>
                  <div className="shrink-0 text-base font-semibold">
                    {formatCurrency(Number(expense.amount), user.currency)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <details className="rounded-2xl border border-border bg-background/40 p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Edit expense
                    </summary>
                    <div className="mt-4">
                      <ExpenseForm
                        accounts={accounts}
                        action={updateAction}
                        defaultAccountId={defaultAccount.id}
                        expense={expense}
                        submitLabel="Save changes"
                      />
                    </div>
                  </details>
                  <form action={deleteAction}>
                    <Button
                      className="h-11 w-full rounded-2xl"
                      type="submit"
                      variant="destructive"
                    >
                      Delete
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}

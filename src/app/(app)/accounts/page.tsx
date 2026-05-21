import Link from "next/link";
import { ArrowLeft, CreditCard, Landmark, Plus, Wallet } from "lucide-react";

import { HabitToast } from "@/components/habit-manage-controls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AccountType, ExpenseCategory } from "@/generated/prisma/enums";
import { formatCurrency } from "@/lib/currency";
import {
  createAccount,
  createTransfer,
  deleteAccount,
  disableAccount,
  setDefaultAccountAction,
  updateAccount,
} from "@/server/accounts/actions";
import { getAccountsWithBalances } from "@/server/accounts/accounts";
import {
  formatUkDate,
  getCurrentUkMonthRange,
  getUkClock,
} from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import { getExpenseCategoryLabel } from "@/server/expenses/categorise-expense";
import { AccountForm } from "../settings/accounts/account-form";

export const dynamic = "force-dynamic";

const accountTypes = Object.values(AccountType);

function getAccountTypeLabel(type: string) {
  return type
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function AccountIcon({ type }: { type: string }) {
  if (type === AccountType.CREDIT_CARD) {
    return <CreditCard className="size-5 text-primary" />;
  }

  if (type === AccountType.BANK) {
    return <Landmark className="size-5 text-primary" />;
  }

  return <Wallet className="size-5 text-primary" />;
}

function getBalancePresentation({
  balance,
  currency,
  type,
}: {
  balance: number;
  currency: string | null;
  type: string;
}) {
  if (type === AccountType.CREDIT_CARD) {
    if (balance < 0) {
      return {
        className: "text-destructive",
        label: "Debt",
        value: `${formatCurrency(Math.abs(balance), currency)} owed`,
      };
    }

    return {
      className: "text-emerald-600",
      label: "Debt",
      value: `${formatCurrency(balance, currency)} credit`,
    };
  }

  return {
    className: balance < 0 ? "text-destructive" : "text-emerald-600",
    label: "Available",
    value: formatCurrency(balance, currency),
  };
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

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return { day, month, year };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function ordinalDay(day: number) {
  const suffix =
    day % 10 === 1 && day % 100 !== 11
      ? "st"
      : day % 10 === 2 && day % 100 !== 12
        ? "nd"
        : day % 10 === 3 && day % 100 !== 13
          ? "rd"
          : "th";

  return `${day}${suffix}`;
}

function getCreditCardDueInfo(dueDay: number) {
  const today = parseDateKey(getUkClock().dateKey);
  let dueYear = today.year;
  let dueMonth = today.month;
  let dueDate = Math.min(dueDay, daysInMonth(dueYear, dueMonth));

  if (today.day > dueDate) {
    dueMonth += 1;

    if (dueMonth > 12) {
      dueMonth = 1;
      dueYear += 1;
    }

    dueDate = Math.min(dueDay, daysInMonth(dueYear, dueMonth));
  }

  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const dueUtc = Date.UTC(dueYear, dueMonth - 1, dueDate);
  const daysUntilDue = Math.round((dueUtc - todayUtc) / 86_400_000);

  return {
    dueLabel: `Due on ${ordinalDay(dueDay)}`,
    daysLabel:
      daysUntilDue === 0
        ? "Due today"
        : daysUntilDue === 1
          ? "Due in 1 day"
          : `Due in ${daysUntilDue} days`,
  };
}

function transactionAmountClass(expense: {
  amount: unknown;
  category: string | null;
}) {
  if (expense.category === ExpenseCategory.TRANSFER) {
    return "text-muted-foreground";
  }

  if (expense.category === ExpenseCategory.INCOME || Number(expense.amount) < 0) {
    return "text-emerald-600";
  }

  return "text-destructive";
}

export default async function AccountsPage() {
  const user = await requireCurrentUser();
  const month = getCurrentUkMonthRange();
  const accounts = await getAccountsWithBalances(user.id);
  const activeAccounts = accounts.filter((account) => account.isActive);
  const [monthExpenses, recentActivity] = await Promise.all([
    prisma.expense.findMany({
      where: {
        userId: user.id,
        expenseDate: {
          gte: month.start,
          lt: month.end,
        },
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        expenseDate: "desc",
      },
    }),
    prisma.expense.findMany({
      where: {
        userId: user.id,
      },
      include: {
        account: {
          select: {
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        expenseDate: "desc",
      },
      take: 10,
    }),
  ]);
  const availableMoney = activeAccounts
    .filter(
      (account) =>
        account.type === AccountType.BANK || account.type === AccountType.CASH,
    )
    .reduce((total, account) => total + account.balance, 0);
  const creditCardDebt = activeAccounts
    .filter((account) => account.type === AccountType.CREDIT_CARD)
    .reduce(
      (total, account) => total + (account.balance < 0 ? Math.abs(account.balance) : 0),
      0,
    );
  const netPosition = availableMoney - creditCardDebt;
  const monthSpendingExpenses = monthExpenses.filter(isSpendingExpense);
  const monthSpending = monthSpendingExpenses.reduce(
    (total, expense) => total + Number(expense.amount),
    0,
  );
  const monthSpendingByAccount = Array.from(
    monthSpendingExpenses.reduce<
      Map<string, { accountId: string; accountName: string; total: number }>
    >(
      (totals, expense) => {
        const key = expense.accountId ?? "no-account";
        const accountName = expense.account?.name ?? "No account";
        const current = totals.get(key) ?? {
          accountId: key,
          accountName,
          total: 0,
        };

        current.total += Number(expense.amount);
        totals.set(key, current);

        return totals;
      },
      new Map(),
    ),
  )
    .map(([, value]) => value)
    .sort((a, b) => b.total - a.total);
  const creditCardAccounts = activeAccounts.filter(
    (account) => account.type === AccountType.CREDIT_CARD,
  );

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
          <p className="text-sm text-muted-foreground">Finance</p>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Available money</CardDescription>
            <CardTitle
              className={
                availableMoney < 0 ? "text-destructive" : "text-emerald-600"
              }
            >
              {formatCurrency(availableMoney, user.currency)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Credit card debt</CardDescription>
            <CardTitle className="text-destructive">
              {formatCurrency(creditCardDebt, user.currency)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net position</CardDescription>
            <CardTitle
              className={netPosition < 0 ? "text-destructive" : "text-emerald-600"}
            >
              {formatCurrency(netPosition, user.currency)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This month spending</CardDescription>
            <CardTitle>{formatCurrency(monthSpending, user.currency)}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Credit card due dates</CardTitle>
            <CardDescription>Payment reminders for active cards.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {creditCardAccounts.length > 0 ? (
              creditCardAccounts.map((account) => {
                const owedAmount = account.balance < 0 ? Math.abs(account.balance) : 0;
                const dueInfo = account.dueDay
                  ? getCreditCardDueInfo(account.dueDay)
                  : null;

                return (
                  <div
                    key={account.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-background/40 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {account.name}
                      </div>
                      <div
                        className={
                          owedAmount > 0
                            ? "text-sm font-medium text-destructive"
                            : "text-sm font-medium text-emerald-600"
                        }
                      >
                        {owedAmount > 0
                          ? `${formatCurrency(owedAmount, user.currency)} owed`
                          : `${formatCurrency(Math.max(account.balance, 0), user.currency)} credit`}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm text-muted-foreground">
                      {dueInfo ? (
                        <>
                          <div>{dueInfo.dueLabel}</div>
                          <div>{dueInfo.daysLabel}</div>
                        </>
                      ) : (
                        <div>No due day set</div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                No credit card accounts yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by account</CardTitle>
            <CardDescription>Current month, excluding income and transfers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {monthSpendingByAccount.length > 0 ? (
              monthSpendingByAccount.map((account) => (
                <div
                  key={account.accountId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/40 p-3"
                >
                  <div className="min-w-0 truncate text-sm font-medium">
                    {account.accountName}
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-destructive">
                    {formatCurrency(account.total, user.currency)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No spending recorded this month.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent account activity</CardTitle>
          <CardDescription>Latest expenses, income and transfers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentActivity.length > 0 ? (
            recentActivity.map((expense) => (
              <div
                key={expense.id}
                className="grid gap-2 rounded-2xl border border-border bg-background/40 p-3 text-sm sm:grid-cols-[110px_1fr_120px]"
              >
                <div className="text-muted-foreground">
                  {formatUkDate(expense.expenseDate)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{expense.description}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {expense.account?.name ?? "No account"} ·{" "}
                    {getExpenseCategoryLabel(expense.category)}
                    {expense.category === ExpenseCategory.TRANSFER
                      ? " · Transfer"
                      : ""}
                  </div>
                </div>
                <div
                  className={`text-left font-semibold sm:text-right ${transactionAmountClass(expense)}`}
                >
                  {formatCurrency(Number(expense.amount), user.currency)}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No account activity yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" />
            Add account
          </CardTitle>
          <CardDescription>
            Add cash, bank accounts or credit cards for expense logging.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountForm
            accountTypes={accountTypes}
            action={createAccount}
            defaultType={AccountType.CASH}
            submitLabel="Create account"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick transfer</CardTitle>
          <CardDescription>
            Move money between accounts without changing spending totals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTransfer} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium">
                Amount
                <input
                  className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  min="0.01"
                  name="amount"
                  placeholder="50.00"
                  required
                  step="0.01"
                  type="number"
                />
              </label>
              <label className="text-sm font-medium">
                From
                <select
                  className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  name="fromAccountId"
                  required
                >
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                To
                <select
                  className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  name="toAccountId"
                  required
                >
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button
              className="h-11 w-full rounded-2xl"
              disabled={activeAccounts.length < 2}
              type="submit"
            >
              Save transfer
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Saved accounts</h2>
          <p className="text-sm text-muted-foreground">
            Balances are calculated from opening balance minus expense amounts.
          </p>
        </div>

        {accounts.map((account) => {
          const updateAction = updateAccount.bind(null, account.id);
          const disableAction = disableAccount.bind(null, account.id);
          const deleteAction = deleteAccount.bind(null, account.id);
          const defaultAction = setDefaultAccountAction.bind(null, account.id);
          const balancePresentation = getBalancePresentation({
            balance: account.balance,
            currency: user.currency,
            type: account.type,
          });

          return (
            <Card key={account.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="flex items-center gap-2 truncate">
                    <AccountIcon type={account.type} />
                    <span className="truncate">{account.name}</span>
                  </CardTitle>
                  <CardDescription>
                    {getAccountTypeLabel(account.type)} ·{" "}
                    {account.isDefault ? "Default" : "Not default"} ·{" "}
                    {account.isActive ? "Active" : "Inactive"}
                  </CardDescription>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`text-base font-semibold ${balancePresentation.className}`}
                  >
                    {balancePresentation.value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {balancePresentation.label}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  <div>
                    Opening{" "}
                    {formatCurrency(Number(account.openingBalance), user.currency)}
                  </div>
                  <div>{account.expenseCount} linked expenses</div>
                  <div>
                    Aliases{" "}
                    {account.aliases.length > 0
                      ? account.aliases.join(", ")
                      : "none"}
                  </div>
                </div>
                <details className="rounded-2xl border border-border bg-background/40 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Edit account
                  </summary>
                  <div className="mt-4">
                    <AccountForm
                      account={account}
                      accountTypes={accountTypes}
                      action={updateAction}
                      defaultType={AccountType.CASH}
                      submitLabel="Save changes"
                    />
                  </div>
                </details>
                <div className="grid gap-2 sm:grid-cols-3">
                  {!account.isDefault ? (
                    <form action={defaultAction}>
                      <Button
                        className="h-11 w-full rounded-2xl"
                        type="submit"
                        variant="secondary"
                      >
                        Set default
                      </Button>
                    </form>
                  ) : null}
                  {account.isActive ? (
                    <form action={disableAction}>
                      <Button
                        className="h-11 w-full rounded-2xl"
                        type="submit"
                        variant="outline"
                      >
                        Disable
                      </Button>
                    </form>
                  ) : null}
                  <form action={deleteAction}>
                    <Button
                      className="h-11 w-full rounded-2xl"
                      disabled={account.expenseCount > 0}
                      type="submit"
                      variant="destructive"
                    >
                      Delete
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

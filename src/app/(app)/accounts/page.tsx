import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  CreditCard,
  Landmark,
  Wallet,
} from "lucide-react";

import { HabitToast } from "@/components/habit-manage-controls";
import { Button } from "@/components/ui/button";
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
import { getCurrentUkMonthRange, getUkClock } from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
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
    daysUntilDue,
    dueLabel: `Due on ${ordinalDay(dueDay)}`,
    daysLabel:
      daysUntilDue === 0
        ? "Due today"
        : daysUntilDue === 1
          ? "Due in 1 day"
          : `Due in ${daysUntilDue} days`,
    shortDaysLabel:
      daysUntilDue === 0
        ? "due today"
        : daysUntilDue === 1
          ? "due in 1d"
          : `due in ${daysUntilDue}d`,
  };
}

function dueStatusClass(daysUntilDue: number) {
  if (daysUntilDue <= 1) {
    return "text-destructive";
  }

  if (daysUntilDue < 7) {
    return "text-amber-600 dark:text-amber-400";
  }

  return "text-muted-foreground";
}

function FoldableSection({
  children,
  description,
  open = false,
  title,
}: {
  children: ReactNode;
  description?: string;
  open?: boolean;
  title: string;
}) {
  return (
    <details
      className="group rounded-3xl border border-border bg-card text-card-foreground shadow-sm"
      open={open}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          {description ? (
            <p className="truncate text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}

export default async function AccountsPage() {
  const user = await requireCurrentUser();
  const month = getCurrentUkMonthRange();
  const accounts = await getAccountsWithBalances(user.id);
  const activeAccounts = accounts.filter((account) => account.isActive);
  const monthExpenses = await prisma.expense.findMany({
    where: {
      userId: user.id,
      expenseDate: {
        gte: month.start,
        lt: month.end,
      },
    },
  });
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

      <FoldableSection
        description="Money, debt and this month at a glance."
        open
        title="Summary"
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <div className="text-xs text-muted-foreground">Available money</div>
            <div
              className={`mt-1 text-lg font-semibold ${
                availableMoney < 0 ? "text-destructive" : "text-emerald-600"
              }`}
            >
              {formatCurrency(availableMoney, user.currency)}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <div className="text-xs text-muted-foreground">Credit card debt</div>
            <div className="mt-1 text-lg font-semibold text-destructive">
              {formatCurrency(creditCardDebt, user.currency)}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <div className="text-xs text-muted-foreground">Net position</div>
            <div
              className={`mt-1 text-lg font-semibold ${
                netPosition < 0 ? "text-destructive" : "text-emerald-600"
              }`}
            >
              {formatCurrency(netPosition, user.currency)}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-3">
            <div className="text-xs text-muted-foreground">This month spending</div>
            <div className="mt-1 text-lg font-semibold">
              {formatCurrency(monthSpending, user.currency)}
            </div>
          </div>
        </div>
      </FoldableSection>

      <FoldableSection
        description="Compact card payment reminders."
        title="Credit card due dates"
      >
        <div className="space-y-2">
          {creditCardAccounts.length > 0 ? (
            creditCardAccounts.map((account) => {
              const owedAmount = account.balance < 0 ? Math.abs(account.balance) : 0;
              const dueInfo = account.dueDay
                ? getCreditCardDueInfo(account.dueDay)
                : null;

              return (
                <div
                  key={account.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-border bg-background/40 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{account.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {dueInfo?.dueLabel ?? "No due day set"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={
                        owedAmount > 0
                          ? "font-semibold text-destructive"
                          : "font-semibold text-emerald-600"
                      }
                    >
                      {owedAmount > 0
                        ? `${formatCurrency(owedAmount, user.currency)} owed`
                        : `${formatCurrency(Math.max(account.balance, 0), user.currency)} credit`}
                    </div>
                    <div
                      className={`text-xs ${
                        dueInfo
                          ? dueStatusClass(dueInfo.daysUntilDue)
                          : "text-muted-foreground"
                      }`}
                    >
                      {dueInfo?.shortDaysLabel ?? "No due day set"}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              No credit card accounts yet.
            </p>
          )}
        </div>
      </FoldableSection>

      <FoldableSection
        description="Move money between accounts."
        title="Quick transfer"
      >
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
      </FoldableSection>

      <FoldableSection
        description="Tap an account to edit settings."
        title="Saved accounts"
      >
        <div className="space-y-2">
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
              <details
                key={account.id}
                className="group rounded-2xl border border-border bg-background/40"
              >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-primary/10">
                    <AccountIcon type={account.type} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {account.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {getAccountTypeLabel(account.type)} ·{" "}
                      {account.isDefault ? "Default" : "Not default"} ·{" "}
                      {account.isActive ? "Active" : "Inactive"}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <div>
                    <div
                      className={`text-sm font-semibold ${balancePresentation.className}`}
                    >
                      {balancePresentation.value}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {balancePresentation.label}
                    </div>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="space-y-3 border-t border-border p-3">
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
              </div>
              </details>
            );
          })}
        </div>
      </FoldableSection>

      <FoldableSection
        description="Create a new cash, bank or credit card account."
        title="Add account"
      >
        <AccountForm
          accountTypes={accountTypes}
          action={createAccount}
          defaultType={AccountType.CASH}
          submitLabel="Create account"
        />
      </FoldableSection>
    </div>
  );
}

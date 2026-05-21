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
import { AccountType } from "@/generated/prisma/enums";
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
import { requireCurrentUser } from "@/server/dashboard/user";
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

export default async function AccountsPage() {
  const user = await requireCurrentUser();
  const accounts = await getAccountsWithBalances(user.id);
  const activeAccounts = accounts.filter((account) => account.isActive);

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
                  <div className="text-base font-semibold">
                    {formatCurrency(account.balance, user.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">Balance</div>
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

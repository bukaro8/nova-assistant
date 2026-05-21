import Link from "next/link";
import { ArrowLeft, CalendarClock, Plus } from "lucide-react";

import { AssistantDisabledCard } from "@/components/assistant-disabled-card";
import { HabitToast } from "@/components/habit-manage-controls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExpenseCategory } from "@/generated/prisma/enums";
import { formatCurrency } from "@/lib/currency";
import { formatUkDate } from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import { getExpenseCategoryLabel } from "@/server/expenses/categorise-expense";
import {
  createRecurringPayment,
  deleteRecurringPayment,
  disableRecurringPayment,
  updateRecurringPayment,
} from "@/server/expenses/recurring-actions";

export const dynamic = "force-dynamic";

const categories = Object.values(ExpenseCategory).filter(
  (category) =>
    category !== ExpenseCategory.INCOME &&
    category !== ExpenseCategory.TRANSFER,
);

function RecurringPaymentForm({
  action,
  submitLabel,
  payment,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  payment?: {
    name: string;
    amount: unknown;
    category: string;
    dayOfMonth: number;
    isActive: boolean;
  };
}) {
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Name
          <input
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            defaultValue={payment?.name}
            maxLength={80}
            name="name"
            placeholder="Rent"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Amount
          <input
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            defaultValue={
              payment ? Number(payment.amount).toFixed(2) : undefined
            }
            min="0.01"
            name="amount"
            placeholder="850.00"
            required
            step="0.01"
            type="number"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Category
          <select
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            defaultValue={payment?.category ?? ExpenseCategory.HOUSING_BILLS}
            name="category"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {getExpenseCategoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Day of month
          <input
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            defaultValue={payment?.dayOfMonth}
            max={31}
            min={1}
            name="dayOfMonth"
            placeholder="1"
            required
            type="number"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          className="size-4 rounded border-border"
          defaultChecked={payment?.isActive ?? true}
          name="isActive"
          type="checkbox"
        />
        Active
      </label>
      <Button className="h-11 w-full rounded-2xl" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}

export default async function RecurringPaymentsPage() {
  const user = await requireCurrentUser();

  if (!user.assistantExpenses) {
    return (
      <AssistantDisabledCard
        title="Expense assistant is disabled"
        description="Enable expense tracking before adding recurring payments."
      />
    );
  }

  const payments = await prisma.recurringPayment.findMany({
    where: {
      userId: user.id,
    },
    orderBy: [
      {
        isActive: "desc",
      },
      {
        nextRunAt: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  return (
    <div className="space-y-5">
      <HabitToast />
      <header className="space-y-3">
        <Link
          href="/expenses"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Expenses
        </Link>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Expense automation</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Recurring payments
          </h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" />
            Add recurring payment
          </CardTitle>
          <CardDescription>
            Monthly payments are recorded automatically on the selected day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecurringPaymentForm
            action={createRecurringPayment}
            submitLabel="Create recurring payment"
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Saved payments</h2>
          <p className="text-sm text-muted-foreground">
            {payments.length} monthly payment{payments.length === 1 ? "" : "s"}
          </p>
        </div>

        {payments.length === 0 ? (
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground">
              No recurring payments yet.
            </CardContent>
          </Card>
        ) : (
          payments.map((payment) => {
            const updateAction = updateRecurringPayment.bind(null, payment.id);
            const disableAction = disableRecurringPayment.bind(
              null,
              payment.id,
            );
            const deleteAction = deleteRecurringPayment.bind(null, payment.id);

            return (
              <Card key={payment.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="flex items-center gap-2 truncate">
                      <CalendarClock className="size-5 shrink-0 text-primary" />
                      <span className="truncate">{payment.name}</span>
                    </CardTitle>
                    <CardDescription>
                      {getExpenseCategoryLabel(payment.category)} ·{" "}
                      {payment.isActive ? "Active" : "Inactive"} · Next run{" "}
                      {formatUkDate(payment.nextRunAt)}
                    </CardDescription>
                  </div>
                  <div className="shrink-0 text-base font-semibold">
                    {formatCurrency(Number(payment.amount), user.currency)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <details className="rounded-2xl border border-border bg-background/40 p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Edit recurring payment
                    </summary>
                    <div className="mt-4">
                      <RecurringPaymentForm
                        action={updateAction}
                        payment={payment}
                        submitLabel="Save changes"
                      />
                    </div>
                  </details>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {payment.isActive ? (
                      <form action={disableAction}>
                        <Button
                          className="h-11 w-full rounded-2xl"
                          type="submit"
                          variant="secondary"
                        >
                          Disable
                        </Button>
                      </form>
                    ) : null}
                    <form action={deleteAction}>
                      <Button
                        className="h-11 w-full rounded-2xl"
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
          })
        )}
      </section>
    </div>
  );
}

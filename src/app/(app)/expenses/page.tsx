import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatUkDate } from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function categoryLabel(category: string | null) {
  if (!category) {
    return "Uncategorised";
  }

  return category.charAt(0) + category.slice(1).toLowerCase();
}

export default async function ExpensesPage() {
  const user = await requireCurrentUser();
  const expenses = await prisma.expense.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      expenseDate: "desc",
    },
    take: 30,
  });

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Latest entries</p>
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
      </header>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            No expenses yet. Send one to the Telegram expense bot.
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          {expenses.map((expense) => (
            <Card key={expense.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="truncate">
                    {expense.description}
                  </CardTitle>
                  <CardDescription>
                    {categoryLabel(expense.category)} ·{" "}
                    {formatUkDate(expense.expenseDate)}
                  </CardDescription>
                </div>
                <div className="shrink-0 text-base font-semibold">
                  {money(Number(expense.amount))}
                </div>
              </CardHeader>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, Plus, Tags } from "lucide-react";

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
import {
  createExpenseCategoryRule,
  deleteExpenseCategoryRule,
  updateExpenseCategoryRule,
} from "@/server/dashboard/actions";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import {
  builtInExpenseCategoryKeywords,
  getExpenseCategoryLabel,
} from "@/server/expenses/categorise-expense";

export const dynamic = "force-dynamic";

const categories = Object.values(ExpenseCategory);

function KeywordInput({
  defaultValue,
}: {
  defaultValue?: string;
}) {
  return (
    <input
      className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      defaultValue={defaultValue}
      maxLength={80}
      name="keyword"
      placeholder="Keyword or phrase"
      required
    />
  );
}

function CategorySelect({
  defaultValue,
}: {
  defaultValue: string;
}) {
  return (
    <select
      className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      defaultValue={defaultValue}
      name="category"
    >
      {categories.map((category) => (
        <option key={category} value={category}>
          {getExpenseCategoryLabel(category)}
        </option>
      ))}
    </select>
  );
}

export default async function ExpenseCategoriesPage() {
  const user = await requireCurrentUser();
  const rules = await prisma.expenseCategoryRule.findMany({
    where: {
      userId: user.id,
    },
    orderBy: [
      {
        category: "asc",
      },
      {
        keyword: "asc",
      },
    ],
  });

  const rulesByCategory = new Map(
    categories.map((category) => [
      category,
      rules.filter((rule) => rule.category === category),
    ]),
  );

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
          <p className="text-sm text-muted-foreground">Expense rules</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Category keywords
          </h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" />
            Add keyword
          </CardTitle>
          <CardDescription>
            Custom keywords override the built-in NOVA keyword list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createExpenseCategoryRule} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <CategorySelect defaultValue={ExpenseCategory.GROCERIES} />
            <KeywordInput />
            <Button className="h-11 rounded-2xl" type="submit">
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        {categories.map((category) => {
          const customRules = rulesByCategory.get(category) ?? [];
          const builtInKeywords = builtInExpenseCategoryKeywords[category];

          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="size-5 text-primary" />
                  {getExpenseCategoryLabel(category)}
                </CardTitle>
                <CardDescription>
                  {builtInKeywords.length} built-in keywords included
                  automatically · {customRules.length} custom
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {builtInKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {builtInKeywords.slice(0, 24).map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
                      >
                        {keyword}
                      </span>
                    ))}
                    {builtInKeywords.length > 24 ? (
                      <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                        +{builtInKeywords.length - 24} more
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                    No built-in keywords for this category.
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-sm font-medium">Custom keywords</div>
                  {customRules.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                      No custom keywords yet.
                    </div>
                  ) : (
                    customRules.map((rule) => {
                      const updateAction = updateExpenseCategoryRule.bind(
                        null,
                        rule.id,
                      );
                      const deleteAction = deleteExpenseCategoryRule.bind(
                        null,
                        rule.id,
                      );

                      return (
                        <details
                          key={rule.id}
                          className="rounded-2xl border border-border bg-background/40 p-3"
                        >
                          <summary className="cursor-pointer text-sm font-medium">
                            {rule.keyword}
                          </summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                            <form
                              action={updateAction}
                              className="contents"
                            >
                              <CategorySelect defaultValue={rule.category} />
                              <KeywordInput defaultValue={rule.keyword} />
                              <Button
                                className="h-11 rounded-2xl"
                                type="submit"
                                variant="outline"
                              >
                                Save
                              </Button>
                            </form>
                            <form action={deleteAction} className="sm:col-span-3">
                              <Button
                                className="h-11 w-full rounded-2xl"
                                type="submit"
                                variant="destructive"
                              >
                                Delete keyword
                              </Button>
                            </form>
                          </div>
                        </details>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

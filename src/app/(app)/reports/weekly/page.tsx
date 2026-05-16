import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Dumbbell,
  ReceiptText,
  RefreshCw,
  Scale,
  Sparkles,
} from "lucide-react";

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
import { formatCurrency } from "@/lib/currency";
import {
  regenerateCurrentWeeklyAiReport,
} from "@/server/reports/actions";
import { requireCurrentUser } from "@/server/dashboard/user";
import {
  formatShortReportDate,
  getCurrentWeeklyReportState,
  WEEKLY_REPORT_FALLBACK,
} from "@/server/reports/weekly-ai-report";

export const dynamic = "force-dynamic";

export default async function WeeklyReportPage() {
  const user = await requireCurrentUser();
  const { week, metrics, report } = await getCurrentWeeklyReportState(user.id);
  const weekTotal = metrics.expenses.totalSpent;
  const categoryData = metrics.expenses.spendByCategory.map((category) => ({
    category: category.label,
    total: category.total,
  }));
  const chartData = metrics.expenses.dailySpending;
  const topExpenses = metrics.expenses.topExpenses;
  const canGenerateReport =
    metrics.hasEnabledAssistants && metrics.meaningfulActivity;
  const aiReportText = report?.reportText ?? WEEKLY_REPORT_FALLBACK;

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
          <p className="text-sm text-muted-foreground">
            {formatShortReportDate(week.start, week.timeZone)} to{" "}
            {formatShortReportDate(new Date(week.end.getTime() - 1), week.timeZone)}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Weekly report
          </h1>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="size-5 text-primary" />
              Total spent
            </CardTitle>
            <CardDescription>Current week</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {formatCurrency(weekTotal, user.currency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" />
              Categories
            </CardTitle>
            <CardDescription>With spending</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {categoryData.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="size-5 text-primary" />
              Habits
            </CardTitle>
            <CardDescription>
              {metrics.habits.completed}/{metrics.habits.scheduledCompletions} completed
            </CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {metrics.habits.completionPercent}%
          </CardContent>
        </Card>
        {user.assistantWeight ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="size-5 text-primary" />
                Weight
              </CardTitle>
              <CardDescription>Current week change</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {metrics.weight.changeKg === null
                ? "No trend"
                : `${metrics.weight.changeKg > 0 ? "+" : ""}${metrics.weight.changeKg.toFixed(1)} kg`}
            </CardContent>
          </Card>
        ) : null}
      </section>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              AI insight report
            </CardTitle>
            <CardDescription>
              {report
                ? `Stored report generated with ${report.model}.`
                : canGenerateReport
                  ? "No stored AI report for this week yet."
                  : "Skipped until there is assistant activity to report."}
            </CardDescription>
          </div>
          {canGenerateReport ? (
            <form action={regenerateCurrentWeeklyAiReport}>
              <Button type="submit" variant="outline">
                <RefreshCw className="size-4" />
                Regenerate report
              </Button>
            </form>
          ) : null}
        </CardHeader>
        <CardContent>
          {canGenerateReport ? (
            <div className="whitespace-pre-line text-sm leading-6 text-foreground">
              {aiReportText}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
              NOVA skips empty AI reports. Enable at least one assistant and log activity this week to generate one.
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily spending chart</CardTitle>
            <CardDescription>Monday to Sunday</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklySpendingChart data={chartData} currency={user.currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spend by category</CardTitle>
            <CardDescription>
              {formatCurrency(weekTotal, user.currency)} categorised this week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdownChart
              data={categoryData}
              currency={user.currency}
            />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Top 5 expenses</CardTitle>
          <CardDescription>Largest individual spending entries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {topExpenses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              No expenses recorded this week.
            </div>
          ) : (
            topExpenses.map((expense) => (
              <div
                key={expense.rank}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/40 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {expense.insightLabel}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {expense.categoryLabel} · {expense.date}
                  </div>
                </div>
                <div className="shrink-0 font-semibold">
                  {formatCurrency(Number(expense.amount), user.currency)}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

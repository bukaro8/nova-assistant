import { saveWeight } from "@/server/dashboard/actions";
import { formatUkDate } from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function WeightPage() {
  const user = await requireCurrentUser();
  const logs = await prisma.weightLog.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Manual logging</p>
        <h1 className="text-2xl font-semibold tracking-tight">Weight</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add weight</CardTitle>
          <CardDescription>Save a new weight log.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveWeight} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Weight</span>
                <input
                  className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  inputMode="decimal"
                  name="weight"
                  placeholder="82.5"
                  required
                  type="number"
                  step="0.1"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Date</span>
                <input
                  className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  name="date"
                  type="date"
                />
              </label>
            </div>
            <Button className="h-12 w-full" type="submit">
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            No weight logs yet.
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>{Number(log.weight)} kg</CardTitle>
                  <CardDescription>{formatUkDate(log.createdAt)}</CardDescription>
                </div>
                <span className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {log.source}
                </span>
              </CardHeader>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

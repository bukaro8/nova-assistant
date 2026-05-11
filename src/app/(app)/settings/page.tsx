import Link from "next/link";
import { ArrowUpRight, Dumbbell, UserCircle, WalletCards } from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { HabitToast } from "@/components/habit-manage-controls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currencyOptions } from "@/lib/currency";
import { updateCurrencyPreference } from "@/server/dashboard/actions";
import { requireCurrentUser } from "@/server/dashboard/user";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireCurrentUser();

  return (
    <div className="space-y-5">
      <HabitToast />
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Configuration</p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WalletCards className="size-5 text-primary" />
            Currency
          </CardTitle>
          <CardDescription>
            Used for display only. NOVA does not convert existing amounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateCurrencyPreference} className="space-y-3">
            <label className="block text-sm font-medium">
              Preferred currency
              <select
                className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                name="currency"
                defaultValue={user.currency}
              >
                {currencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button className="h-11 w-full rounded-2xl" type="submit">
              Save currency
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Account, bot management, and deployment settings will live here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <Link
            href="/habits/manage"
            className="flex min-h-16 items-center justify-between rounded-2xl border border-border bg-background px-4 text-foreground transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-3">
              <Dumbbell className="size-5 text-primary" />
              Manage habits
            </span>
            <ArrowUpRight className="size-4" />
          </Link>
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="mb-3 flex items-center gap-3 text-foreground">
              <UserCircle className="size-5 text-primary" />
              <div>
                <div className="font-medium">{user.name ?? "NOVA user"}</div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

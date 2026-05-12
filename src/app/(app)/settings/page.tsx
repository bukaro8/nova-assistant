import Link from "next/link";
import {
  ArrowUpRight,
  Dumbbell,
  ExternalLink,
  ReceiptText,
  Scale,
  Send,
  ShieldCheck,
  Smartphone,
  UserCircle,
  WalletCards,
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { HabitToast } from "@/components/habit-manage-controls";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { currencyOptions } from "@/lib/currency";
import {
  createTelegramConnectionCodeAction,
  disconnectTelegram,
  sendTelegramTestMessage,
  updateAssistantPreferences,
  updateCurrencyPreference,
} from "@/server/dashboard/actions";
import { requireCurrentUser } from "@/server/dashboard/user";

export const dynamic = "force-dynamic";

const telegramAssistantUrl = "https://t.me/mynovaassistant_bot";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    telegramCode?: string;
  }>;
}) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const telegramConnected = Boolean(
    user.telegramHabitChatId || user.telegramExpenseChatId,
  );
  const telegramConnectUrl = params.telegramCode
    ? `${telegramAssistantUrl}?start=${encodeURIComponent(params.telegramCode)}`
    : null;

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
          <CardTitle>Assistants</CardTitle>
          <CardDescription>Choose what NOVA helps you with.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateAssistantPreferences} className="space-y-3">
            {[
              {
                name: "assistantHabits",
                title: "Habits & reminders",
                description: "Daily reminders, streaks and routines",
                icon: Dumbbell,
                defaultChecked: user.assistantHabits,
              },
              {
                name: "assistantWeight",
                title: "Weight tracking",
                description: "Track progress and body trends",
                icon: Scale,
                defaultChecked: user.assistantWeight,
              },
              {
                name: "assistantExpenses",
                title: "Expense tracking",
                description: "Track spending and categories",
                icon: ReceiptText,
                defaultChecked: user.assistantExpenses,
              },
            ].map((assistant) => {
              const Icon = assistant.icon;

              return (
                <label
                  key={assistant.name}
                  className="flex min-h-20 cursor-pointer items-center gap-3 rounded-3xl border border-border bg-background p-4 transition-colors hover:bg-muted"
                >
                  <input
                    className="size-5 accent-primary"
                    defaultChecked={assistant.defaultChecked}
                    name={assistant.name}
                    type="checkbox"
                  />
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">
                      {assistant.title}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {assistant.description}
                    </span>
                  </span>
                </label>
              );
            })}
            <Button className="h-11 w-full rounded-2xl" type="submit">
              Save assistants
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="size-5 text-primary" />
            Connect NOVA Assistant
          </CardTitle>
          <CardDescription>
            Get reminders and log habits/expenses directly from Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {telegramConnected ? (
            <>
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-500">
                    <ShieldCheck className="size-5" />
                  </span>
                  <div>
                    <div className="font-medium">
                      ✅ NOVA Assistant connected
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You will receive reminders and can log habits and expenses
                      in Telegram.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <form action={sendTelegramTestMessage}>
                  <Button
                    className="h-12 w-full rounded-2xl"
                    type="submit"
                    variant="outline"
                  >
                    <Send className="size-4" />
                    Send test message
                  </Button>
                </form>
                <form action={disconnectTelegram}>
                  <Button
                    className="h-12 w-full rounded-2xl"
                    type="submit"
                    variant="destructive"
                  >
                    Disconnect Telegram
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-3xl border border-border bg-background p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                    1
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      Don&apos;t have Telegram yet?
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Install Telegram first, then come back to connect NOVA.
                    </p>
                    <a
                      className={buttonVariants({
                        variant: "outline",
                        className: "mt-3 h-11 rounded-2xl",
                      })}
                      href="https://telegram.org/"
                      rel="noreferrer"
                      target="_blank"
                    >
                      Get Telegram
                      <ExternalLink className="size-4" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-primary/25 bg-primary/10 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                    2
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <div className="font-medium">Connect assistant</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Open Telegram and finish the secure connection in one
                        tap.
                      </p>
                    </div>

                    {telegramConnectUrl ? (
                      <>
                        <a
                          className={buttonVariants({
                            className: "h-12 w-full rounded-2xl",
                          })}
                          href={telegramConnectUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Connect with Telegram
                          <ArrowUpRight className="size-4" />
                        </a>
                        <p className="text-sm text-muted-foreground">
                          Telegram will open automatically. Press START to
                          finish connecting.
                        </p>
                      </>
                    ) : (
                      <form action={createTelegramConnectionCodeAction}>
                        <Button className="h-12 w-full rounded-2xl" type="submit">
                          Connect Telegram
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
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

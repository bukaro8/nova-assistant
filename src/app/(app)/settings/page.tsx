import Link from "next/link";
import { ArrowUpRight, Dumbbell } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Configuration</p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Authentication, bot management, and deployment settings will live here later.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
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
        </CardContent>
      </Card>
    </div>
  );
}

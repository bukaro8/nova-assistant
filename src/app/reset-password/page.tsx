import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { NovaBrand } from "@/components/nova-brand";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/server/auth/options";
import {
  getPasswordResetTokenStatus,
  resetPassword,
} from "@/server/auth/password-reset";

export const dynamic = "force-dynamic";

function tokenMessage(status: "missing" | "invalid" | "expired" | "valid") {
  if (status === "expired") {
    return "This reset link has expired. Request a new one to continue.";
  }

  return "This reset link is invalid. Request a new one to continue.";
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    type?: string;
    message?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const token = params.token;
  const status = await getPasswordResetTokenStatus(token);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <NovaBrand />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>
              Use at least 8 characters for your NOVA password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {params.type === "error" && params.message ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {params.message}
              </div>
            ) : null}

            {status === "valid" && token ? (
              <form action={resetPassword} className="space-y-4">
                <input name="token" type="hidden" value={token} />
                <label className="block text-sm font-medium">
                  New password
                  <input
                    autoComplete="new-password"
                    className="mt-1 h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    minLength={8}
                    name="password"
                    required
                    type="password"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Confirm password
                  <input
                    autoComplete="new-password"
                    className="mt-1 h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    minLength={8}
                    name="confirmPassword"
                    required
                    type="password"
                  />
                </label>
                <Button className="h-12 w-full rounded-2xl" type="submit">
                  Reset password
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {tokenMessage(status)}
                </div>
                <Link
                  className={buttonVariants({
                    className: "h-12 w-full rounded-2xl",
                  })}
                  href="/forgot-password"
                >
                  Request a new link
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { NovaBrand } from "@/components/nova-brand";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/server/auth/options";
import { requestPasswordReset } from "@/server/auth/password-reset";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    message?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <NovaBrand />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>
              Enter your email and NOVA will send reset instructions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {params.sent ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
                {params.message ??
                  "If an account exists, we sent reset instructions."}
              </div>
            ) : null}
            <form action={requestPasswordReset} className="space-y-4">
              <label className="block text-sm font-medium">
                Email
                <input
                  autoComplete="email"
                  className="mt-1 h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  name="email"
                  required
                  type="email"
                />
              </label>
              <Button className="h-12 w-full rounded-2xl" type="submit">
                Send reset instructions
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              Remembered your password?{" "}
              <Link className="font-medium text-foreground underline" href="/login">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

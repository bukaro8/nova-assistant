import Link from "next/link";

import { NovaBrand } from "@/components/nova-brand";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  resendVerificationEmail,
  verifyEmailToken,
} from "@/server/auth/email-verification";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    message?: string;
    sent?: string;
    token?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;

  if (params.token) {
    await verifyEmailToken(params.token);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <NovaBrand />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Verify your email</CardTitle>
            <CardDescription>
              Password accounts are created after email verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {params.sent ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
                Check your email for a NOVA verification link.
              </div>
            ) : null}
            {params.type === "error" && params.message ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {params.message}
              </div>
            ) : null}
            <form action={resendVerificationEmail} className="space-y-3">
              <label className="block text-sm font-medium">
                Email
                <input
                  autoComplete="email"
                  className="mt-1 h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  defaultValue={params.email}
                  name="email"
                  required
                  type="email"
                />
              </label>
              <Button className="h-12 w-full rounded-2xl" type="submit">
                Resend verification email
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              Already verified?{" "}
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

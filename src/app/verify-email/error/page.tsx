import Link from "next/link";

import { NovaBrand } from "@/components/nova-brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function getErrorMessage(reason: string | undefined) {
  if (reason === "expired") {
    return "This verification link has expired. Request a new email to continue.";
  }

  return "This verification link is invalid or has already been used.";
}

export default async function VerifyEmailErrorPage({
  searchParams,
}: {
  searchParams: Promise<{
    reason?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <NovaBrand />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Email verification failed</CardTitle>
            <CardDescription>{getErrorMessage(params.reason)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/verify-email"
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Resend verification email
            </Link>
            <Link
              href="/register"
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              Register again
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

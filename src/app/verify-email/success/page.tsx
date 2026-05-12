import Link from "next/link";

import { NovaBrand } from "@/components/nova-brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function VerifyEmailSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
  }>;
}) {
  const params = await searchParams;
  const loginHref = params.email
    ? `/login?registered=1&message=${encodeURIComponent(
        "Email verified. Sign in to continue.",
      )}&email=${encodeURIComponent(params.email)}`
    : "/login";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <NovaBrand />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Email verified</CardTitle>
            <CardDescription>Your NOVA account has been created.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={loginHref}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { NovaBrand } from "@/components/nova-brand";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { registerUser } from "@/server/auth/actions";
import { authOptions } from "@/server/auth/options";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
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
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Create your NOVA account. Currency defaults to GBP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {params.type === "error" && params.message ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {params.message}
              </div>
            ) : null}
            <GoogleSignInButton callbackUrl="/dashboard" />
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <form action={registerUser} className="space-y-4">
              <label className="block text-sm font-medium">
                Name
                <input
                  autoComplete="name"
                  className="mt-1 h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  name="name"
                  required
                />
              </label>
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
              <label className="block text-sm font-medium">
                Password
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
                Send verification email
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
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

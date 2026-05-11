import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { NovaBrand } from "@/components/nova-brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/server/auth/options";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    email?: string;
    message?: string;
    registered?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const callbackUrl =
    params.callbackUrl?.startsWith("/") && !params.callbackUrl.startsWith("//")
      ? params.callbackUrl
      : "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <NovaBrand />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your NOVA account to continue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {params.registered ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
                {params.message ?? "Account created. Sign in to continue."}
              </div>
            ) : null}
            <LoginForm callbackUrl={callbackUrl} defaultEmail={params.email} />
            <p className="text-center text-sm text-muted-foreground">
              New to NOVA?{" "}
              <Link className="font-medium text-foreground underline" href="/register">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

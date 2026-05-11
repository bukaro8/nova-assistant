import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/server/auth/options";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const primaryHref = session?.user?.id ? "/dashboard" : "/login";
  const primaryLabel = session?.user?.id ? "Open dashboard" : "Sign in";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Personal Assistant
        </p>
        <h1 className="text-4xl font-semibold">NOVA</h1>
        <p className="text-muted-foreground">
          Project foundation is ready for the next implementation phase.
        </p>
        <Link
          href={primaryHref}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {primaryLabel}
        </Link>
        {!session?.user?.id ? (
          <div className="text-sm text-muted-foreground">
            New here?{" "}
            <Link className="font-medium text-foreground underline" href="/register">
              Create an account
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

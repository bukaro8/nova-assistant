import Link from "next/link";

export default function Home() {
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
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Open dashboard
        </Link>
      </div>
    </main>
  );
}

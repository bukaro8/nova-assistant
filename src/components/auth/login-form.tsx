"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function LoginForm({
  callbackUrl,
  defaultEmail,
}: {
  callbackUrl: string;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }

      router.push(result?.url ?? callbackUrl);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className="mt-1 h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          defaultValue={defaultEmail}
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block text-sm font-medium">
        Password
        <input
          autoComplete="current-password"
          className="mt-1 h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          name="password"
          required
          type="password"
        />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button className="h-12 w-full rounded-2xl" disabled={isPending} type="submit">
        {isPending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

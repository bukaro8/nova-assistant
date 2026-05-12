"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function GoogleSignInButton({
  callbackUrl,
}: {
  callbackUrl: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="h-12 w-full rounded-2xl"
      disabled={isPending}
      type="button"
      variant="outline"
      onClick={() => {
        startTransition(() => {
          void signIn("google", { callbackUrl });
        });
      }}
    >
      <span className="grid size-5 place-items-center rounded-full bg-white text-sm font-semibold text-slate-900">
        G
      </span>
      {isPending ? "Opening Google..." : "Continue with Google"}
    </Button>
  );
}

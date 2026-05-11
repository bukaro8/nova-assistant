"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function NovaBrand({ className }: { className?: string }) {
  const [logoLoaded, setLogoLoaded] = useState(true);

  return (
    <Link
      href="/dashboard"
      className={cn(
        "inline-flex items-center gap-3 align-middle text-foreground transition-opacity hover:opacity-85",
        className,
      )}
      aria-label="NOVA dashboard"
    >
      {logoLoaded ? (
        <Image
          src="/branding/logo-nova.png"
          alt="NOVA logo"
          width={120}
          height={120}
          className="h-14 w-auto shrink-0 object-contain sm:h-16"
          priority
          onError={() => setLogoLoaded(false)}
        />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-2xl border border-border bg-card text-xs font-semibold tracking-[0.14em] text-foreground sm:size-10">
          NOVA
        </span>
      )}
      <span className="-translate-y-px font-sans text-base font-medium leading-none tracking-[0.14em] text-foreground sm:text-lg">
        NOVA
      </span>
    </Link>
  );
}

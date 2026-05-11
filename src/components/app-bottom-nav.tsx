"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Dumbbell,
  Home,
  ReceiptText,
  Scale,
  Settings,
} from "lucide-react";

import { NovaBrand } from "@/components/nova-brand";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: Home,
  },
  {
    href: "/habits",
    label: "Habits",
    icon: Dumbbell,
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: ReceiptText,
  },
  {
    href: "/weight",
    label: "Weight",
    icon: Scale,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 rounded-3xl border border-border bg-card/90 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-xl md:inset-y-4 md:left-4 md:right-auto md:w-56 md:rounded-3xl">
      <div className="mx-auto grid h-16 max-w-xl grid-cols-5 md:flex md:h-full md:max-w-none md:flex-col md:gap-1 md:p-3">
        <div className="hidden px-3 pb-5 pt-2 md:block">
          <NovaBrand />
          <div className="mt-2 text-sm text-muted-foreground">
            Personal dashboard
          </div>
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-medium text-muted-foreground transition-colors md:h-11 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-sm",
                active && "bg-primary/15 text-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <BarChart3 className="hidden" aria-hidden="true" />
      </div>
    </nav>
  );
}

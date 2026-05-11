"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      className="h-11 w-full rounded-2xl"
      type="button"
      variant="outline"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}

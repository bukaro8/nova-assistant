"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export function LogoutOnLoad() {
  useEffect(() => {
    void signOut({ callbackUrl: "/login" });
  }, []);

  return null;
}

"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { prisma } from "@/server/db/prisma";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function registerRedirect(type: "error" | "success", message: string): never {
  const params = new URLSearchParams({ type, message });
  redirect(`/register?${params.toString()}`);
}

function loginRedirect(message: string, email: string): never {
  const params = new URLSearchParams({
    registered: "1",
    message,
    email,
  });
  redirect(`/login?${params.toString()}`);
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function registerUser(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    registerRedirect("error", "Name, email, and password are required.");
  }

  if (!EMAIL_PATTERN.test(email)) {
    registerRedirect("error", "Enter a valid email address.");
  }

  if (password.length < 8) {
    registerRedirect("error", "Password must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        currency: "GBP",
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      registerRedirect("error", "An account already exists for that email.");
    }

    throw error;
  }

  loginRedirect("Account created. Sign in to continue.", email);
}

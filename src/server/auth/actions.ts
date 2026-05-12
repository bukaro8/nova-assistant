"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { createEmailVerification } from "@/server/auth/email-verification";
import { prisma } from "@/server/db/prisma";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function registerRedirect(type: "error" | "success", message: string): never {
  const params = new URLSearchParams({ type, message });
  redirect(`/register?${params.toString()}`);
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
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!name || !email || !password || !confirmPassword) {
    registerRedirect(
      "error",
      "Name, email, password, and confirmation are required.",
    );
  }

  if (!EMAIL_PATTERN.test(email)) {
    registerRedirect("error", "Enter a valid email address.");
  }

  if (password.length < 8) {
    registerRedirect("error", "Password must be at least 8 characters.");
  }

  if (password !== confirmPassword) {
    registerRedirect("error", "Passwords do not match.");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    registerRedirect("error", "An account already exists for that email.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await createEmailVerification({
      name,
      email,
      passwordHash,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      registerRedirect("error", "An account already exists for that email.");
    }

    if (
      error instanceof Error &&
      error.message === "Email service is not configured."
    ) {
      registerRedirect("error", "Email verification is not configured.");
    }

    throw error;
  }

  redirect(`/verify-email?sent=1&email=${encodeURIComponent(email)}`);
}

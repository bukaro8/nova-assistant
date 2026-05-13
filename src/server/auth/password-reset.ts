"use server";

import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { prisma } from "@/server/db/prisma";

const TOKEN_TTL_MINUTES = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_SUCCESS_MESSAGE =
  "If an account exists, we sent reset instructions.";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getBaseUrl() {
  const configuredUrl = process.env.NEXTAUTH_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

function getConfiguredBaseUrl() {
  const configuredUrl = process.env.NEXTAUTH_URL?.trim();

  return configuredUrl ? configuredUrl.replace(/\/+$/, "") : null;
}

function getResetUrl(token: string) {
  return `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

function buildPasswordResetEmail({
  name,
  resetUrl,
}: {
  name: string;
  resetUrl: string;
}) {
  const configuredBaseUrl = getConfiguredBaseUrl();
  const logoHtml = configuredBaseUrl
    ? `<img src="${configuredBaseUrl}/branding/logo-nova.png" width="72" height="72" alt="NOVA logo" style="display:block;margin:0 auto 12px;border:0;" />`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#070b12;color:#f8fafc;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070b12;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f172a;border:1px solid #1e293b;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 12px;text-align:center;">
                ${logoHtml}
                <div style="font-size:18px;font-weight:700;letter-spacing:0.18em;">NOVA</div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 28px;">
                <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#f8fafc;">Reset your password</h1>
                <p style="margin:0 0 18px;color:#cbd5e1;font-size:16px;line-height:1.6;">Hi ${name}, use this secure link to choose a new NOVA password.</p>
                <a href="${resetUrl}" style="display:block;text-align:center;background:#f8fafc;color:#020617;text-decoration:none;font-weight:700;border-radius:16px;padding:14px 18px;margin:24px 0;">Reset password</a>
                <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">This link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendPasswordResetEmail({
  email,
  name,
  token,
}: {
  email: string;
  name: string;
  token: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("Email service is not configured.");
  }

  const resetUrl = getResetUrl(token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Reset your NOVA password",
      html: buildPasswordResetEmail({ name, resetUrl }),
      text: `Reset your NOVA password: ${resetUrl}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to send password reset email: ${detail}`);
  }
}

function forgotPasswordRedirect(): never {
  const params = new URLSearchParams({
    sent: "1",
    message: GENERIC_SUCCESS_MESSAGE,
  });
  redirect(`/forgot-password?${params.toString()}`);
}

function resetPasswordRedirect(
  type: "error" | "success",
  message: string,
  token?: string,
): never {
  const params = new URLSearchParams({ type, message });

  if (token) {
    params.set("token", token);
  }

  redirect(`/reset-password?${params.toString()}`);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    forgotPasswordRedirect();
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    forgotPasswordRedirect();
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  try {
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: {
          email,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      }),
      prisma.passwordResetToken.create({
        data: {
          email,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    await sendPasswordResetEmail({
      email,
      name: user.name ?? "there",
      token,
    });
  } catch (error) {
    console.error("[auth:password-reset] Failed to send reset email.", error);
  }

  forgotPasswordRedirect();
}

export async function getPasswordResetTokenStatus(rawToken: string | undefined) {
  if (!rawToken) {
    return "missing" as const;
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: {
      tokenHash: hashToken(rawToken),
    },
  });

  if (!resetToken || resetToken.usedAt) {
    return "invalid" as const;
  }

  if (resetToken.expiresAt <= new Date()) {
    return "expired" as const;
  }

  return "valid" as const;
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    resetPasswordRedirect("error", "Reset link is missing.");
  }

  if (!password || !confirmPassword) {
    resetPasswordRedirect("error", "Enter and confirm your new password.", token);
  }

  if (password.length < 8) {
    resetPasswordRedirect(
      "error",
      "Password must be at least 8 characters.",
      token,
    );
  }

  if (password !== confirmPassword) {
    resetPasswordRedirect("error", "Passwords do not match.", token);
  }

  const tokenHash = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: {
      tokenHash,
    },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    resetPasswordRedirect("error", "Reset link is invalid or expired.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: {
        email: resetToken.email,
      },
      data: {
        passwordHash,
      },
    }),
    prisma.passwordResetToken.update({
      where: {
        id: resetToken.id,
      },
      data: {
        usedAt: new Date(),
      },
    }),
  ]);

  redirect(
    `/login?${new URLSearchParams({
      email: resetToken.email,
      registered: "1",
      message: "Password reset. Sign in with your new password.",
    }).toString()}`,
  );
}

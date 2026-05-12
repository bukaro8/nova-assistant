"use server";

import { createHash, randomBytes } from "node:crypto";

import { redirect } from "next/navigation";

import { prisma } from "@/server/db/prisma";

const TOKEN_TTL_HOURS = 24;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getBaseUrl() {
  const configuredUrl = process.env.NEXTAUTH_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

function getVerificationUrl(token: string) {
  return `${getBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildVerificationEmail({
  name,
  verificationUrl,
}: {
  name: string;
  verificationUrl: string;
}) {
  const logoUrl = `${getBaseUrl()}/branding/logo-nova.png`;

  return `<!doctype html>
<html>
  <body style="margin:0;background:#070b12;color:#f8fafc;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070b12;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f172a;border:1px solid #1e293b;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 12px;text-align:center;">
                <img src="${logoUrl}" width="72" height="72" alt="NOVA" style="display:block;margin:0 auto 12px;border:0;" />
                <div style="font-size:18px;font-weight:700;letter-spacing:0.18em;">NOVA</div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 28px;">
                <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#f8fafc;">Verify your email</h1>
                <p style="margin:0 0 18px;color:#cbd5e1;font-size:16px;line-height:1.6;">Hi ${name}, confirm this email address to create your NOVA account.</p>
                <a href="${verificationUrl}" style="display:block;text-align:center;background:#f8fafc;color:#020617;text-decoration:none;font-weight:700;border-radius:16px;padding:14px 18px;margin:24px 0;">Verify account</a>
                <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">This link expires in 24 hours. If you did not request this, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendVerificationEmail({
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

  const verificationUrl = getVerificationUrl(token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Verify your NOVA account",
      html: buildVerificationEmail({ name, verificationUrl }),
      text: `Verify your NOVA account: ${verificationUrl}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to send verification email: ${detail}`);
  }
}

export async function createEmailVerification({
  email,
  name,
  passwordHash,
}: {
  email: string;
  name: string;
  passwordHash: string;
}) {
  const token = randomBytes(32).toString("hex");
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.deleteMany({
    where: {
      email,
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      email,
      token: hashedToken,
      pendingName: name,
      pendingPasswordHash: passwordHash,
      expiresAt,
    },
  });

  await sendVerificationEmail({ email, name, token });
}

export async function resendVerificationEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect("/verify-email?type=error&message=Enter your email address.");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    redirect("/login?email=" + encodeURIComponent(email));
  }

  const pendingToken = await prisma.emailVerificationToken.findFirst({
    where: {
      email,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!pendingToken) {
    redirect(
      `/verify-email?type=error&message=${encodeURIComponent(
        "No pending verification found. Register again to receive a new link.",
      )}`,
    );
  }

  const token = randomBytes(32).toString("hex");
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.update({
    where: {
      id: pendingToken.id,
    },
    data: {
      token: hashedToken,
      expiresAt,
    },
  });

  await sendVerificationEmail({
    email,
    name: pendingToken.pendingName,
    token,
  });

  redirect(`/verify-email?sent=1&email=${encodeURIComponent(email)}`);
}

export async function verifyEmailToken(rawToken: string) {
  const hashedToken = hashToken(rawToken);
  const pendingToken = await prisma.emailVerificationToken.findUnique({
    where: {
      token: hashedToken,
    },
  });

  if (!pendingToken) {
    redirect("/verify-email/error?reason=invalid");
  }

  if (pendingToken.expiresAt <= new Date()) {
    await prisma.emailVerificationToken.delete({
      where: {
        id: pendingToken.id,
      },
    });
    redirect("/verify-email/error?reason=expired");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: pendingToken.email,
    },
  });

  if (existingUser) {
    await prisma.emailVerificationToken.delete({
      where: {
        id: pendingToken.id,
      },
    });
    redirect(`/login?email=${encodeURIComponent(pendingToken.email)}`);
  }

  await prisma.$transaction([
    prisma.user.create({
      data: {
        name: pendingToken.pendingName,
        email: pendingToken.email,
        passwordHash: pendingToken.pendingPasswordHash,
        currency: "GBP",
      },
    }),
    prisma.emailVerificationToken.delete({
      where: {
        id: pendingToken.id,
      },
    }),
  ]);

  redirect(`/verify-email/success?email=${encodeURIComponent(pendingToken.email)}`);
}

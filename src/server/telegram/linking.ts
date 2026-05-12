import { createHash, randomInt } from "node:crypto";

import { prisma } from "@/server/db/prisma";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 10;
const CODE_PATTERN = /^[A-Z0-9]{6}$/;

export type TelegramConnectionKind = "habit" | "expense";

export function normalizeTelegramConnectionCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function looksLikeTelegramConnectionCode(value: string) {
  return CODE_PATTERN.test(normalizeTelegramConnectionCode(value));
}

export function extractTelegramStartCode(value: string) {
  const match = value.trim().match(/^\/start(?:@\w+)?\s+(.+)$/i);

  if (!match) {
    return null;
  }

  return normalizeTelegramConnectionCode(match[1]);
}

export function hashTelegramConnectionCode(code: string) {
  return createHash("sha256")
    .update(normalizeTelegramConnectionCode(code))
    .digest("hex");
}

export function createPlainTelegramConnectionCode() {
  let code = "";

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }

  return code;
}

export async function createTelegramConnectionCode(userId: string) {
  await prisma.telegramConnectionCode.deleteMany({
    where: {
      OR: [
        {
          userId,
          usedAt: null,
        },
        {
          expiresAt: {
            lt: new Date(),
          },
        },
      ],
    },
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createPlainTelegramConnectionCode();
    const codeHash = hashTelegramConnectionCode(code);

    try {
      await prisma.telegramConnectionCode.create({
        data: {
          userId,
          codeHash,
          expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
        },
      });

      return code;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Could not generate a Telegram connection code.");
}

export async function claimTelegramConnectionCode({
  chatId,
  code,
  kind,
}: {
  chatId: string;
  code: string;
  kind: TelegramConnectionKind;
}) {
  const now = new Date();
  const codeHash = hashTelegramConnectionCode(code);
  const pendingCode = await prisma.telegramConnectionCode.findUnique({
    where: {
      codeHash,
    },
    include: {
      user: true,
    },
  });

  if (!pendingCode || pendingCode.usedAt || pendingCode.expiresAt <= now) {
    return {
      status: "invalid",
    } as const;
  }

  const chatIdField =
    kind === "habit" ? "telegramHabitChatId" : "telegramExpenseChatId";
  const existingChatUser =
    kind === "habit"
      ? await prisma.user.findUnique({
          where: {
            telegramHabitChatId: chatId,
          },
        })
      : await prisma.user.findUnique({
          where: {
            telegramExpenseChatId: chatId,
          },
        });

  if (existingChatUser && existingChatUser.id !== pendingCode.userId) {
    return {
      status: "already-linked",
    } as const;
  }

  try {
    const user = await prisma.user.update({
      where: {
        id: pendingCode.userId,
      },
      data: {
        [chatIdField]: chatId,
        telegramConnectionCodes: {
          update: {
            where: {
              id: pendingCode.id,
            },
            data: {
              usedAt: now,
            },
          },
        },
      },
    });

    return {
      status: "linked",
      user,
    } as const;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return {
        status: "already-linked",
      } as const;
    }

    throw error;
  }
}

import "dotenv/config";

import { pathToFileURL } from "node:url";

import { prisma } from "../db/prisma";
import {
  requireHabitBotToken,
  sendTelegramMessage,
  type TelegramUser,
  telegramRequest,
} from "./api";
import {
  claimTelegramConnectionCode,
  extractTelegramStartCode,
  looksLikeTelegramConnectionCode,
  normalizeTelegramConnectionCode,
} from "./linking";

type TelegramChat = {
  id: number;
  type: string;
};

type TelegramMessage = {
  message_id: number;
  date: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

function debug(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.log(`[telegram:habit] ${message}`, meta);
    return;
  }

  console.log(`[telegram:habit] ${message}`);
}

function normalizeReply(text: string) {
  return text.trim().toLowerCase();
}

function getLocalDayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

async function findLinkedUser(chatId: string) {
  const existingUser = await prisma.user.findUnique({
    where: {
      telegramHabitChatId: chatId,
    },
  });

  if (existingUser) {
    debug("User found by telegramHabitChatId.", {
      chatId,
      userId: existingUser.id,
      email: existingUser.email,
    });
    return existingUser;
  }

  debug("No user found for telegramHabitChatId.", { chatId });
  return null;
}

async function logHabitReply(message: TelegramMessage) {
  const replyText = message.text?.trim();
  const chatId = String(message.chat.id);

  debug("Incoming Telegram message.", {
    chatId,
    text: message.text,
    messageId: message.message_id,
    telegramDate: message.date,
  });

  if (!replyText) {
    console.warn(`Ignoring non-text Telegram message from chat ${chatId}.`);
    return;
  }

  const startCode = extractTelegramStartCode(replyText);

  if (startCode) {
    const result = await claimTelegramConnectionCode({
      chatId,
      code: startCode,
      kind: "habit",
    });

    if (result.status === "linked") {
      await sendTelegramMessage(
        chatId,
        "✅ Telegram connected to NOVA habit reminders.",
      );
      console.log(
        `Linked Telegram habit chat ${chatId} to ${result.user.email}.`,
      );
      return;
    }

    if (result.status === "already-linked") {
      await sendTelegramMessage(
        chatId,
        "This Telegram account is already connected to another NOVA account.",
      );
      console.warn(`Telegram habit chat ${chatId} is already linked elsewhere.`);
      return;
    }

    await sendTelegramMessage(
      chatId,
      "❌ Invalid or expired NOVA connection code. Generate a new code in Settings.",
    );
    console.warn(`Invalid Telegram habit /start connection code from chat ${chatId}.`);
    return;
  }

  const user = await findLinkedUser(chatId);

  if (!user) {
    if (looksLikeTelegramConnectionCode(replyText)) {
      const result = await claimTelegramConnectionCode({
        chatId,
        code: normalizeTelegramConnectionCode(replyText),
        kind: "habit",
      });

      if (result.status === "linked") {
        await sendTelegramMessage(
          chatId,
          "✅ Telegram connected to NOVA habit reminders.",
        );
        console.log(`Linked Telegram habit chat ${chatId} to ${result.user.email}.`);
        return;
      }

      if (result.status === "already-linked") {
        await sendTelegramMessage(
          chatId,
          "This Telegram account is already connected to another NOVA account.",
        );
        console.warn(`Telegram habit chat ${chatId} is already linked elsewhere.`);
        return;
      }

      await sendTelegramMessage(
        chatId,
        "❌ Invalid or expired NOVA connection code. Generate a new code in Settings.",
      );
      console.warn(`Invalid Telegram habit connection code from chat ${chatId}.`);
      return;
    }

    console.warn(`No NOVA user available for Telegram habit chat ${chatId}.`);
    await sendTelegramMessage(
      chatId,
      "Connect this chat from NOVA Settings before logging habits.",
    );
    return;
  }

  const normalizedReply = normalizeReply(replyText);
  debug("Normalised reply text.", {
    chatId,
    normalizedReply,
  });

  const habits = await prisma.habit.findMany({
    where: {
      userId: user.id,
      active: true,
    },
  });

  const matchingHabits = habits.filter((candidate) =>
    candidate.validReplies.some(
      (validReply) => normalizeReply(validReply) === normalizedReply,
    ),
  );

  debug("Habit match result.", {
    chatId,
    userId: user.id,
    normalizedReply,
    activeHabitCount: habits.length,
    matchCount: matchingHabits.length,
    matchedHabitCodes: matchingHabits.map((habit) => habit.code),
  });

  if (matchingHabits.length === 0) {
    console.warn(
      `Invalid habit reply "${replyText}" from chat ${chatId}; no matching habit validReplies entry.`,
    );
    return;
  }

  if (matchingHabits.length > 1) {
    console.warn(
      `Ambiguous habit reply "${replyText}" from chat ${chatId}; matched habit codes: ${matchingHabits.map((habit) => habit.code).join(", ")}.`,
    );
    return;
  }

  const [habit] = matchingHabits;
  const loggedAt = new Date(message.date * 1000);
  const { start, end } = getLocalDayRange(loggedAt);

  const existingLog = await prisma.habitLog.findFirst({
    where: {
      userId: user.id,
      habitId: habit.id,
      loggedAt: {
        gte: start,
        lt: end,
      },
    },
  });

  if (existingLog) {
    const updatedLog = await prisma.habitLog.update({
      where: {
        id: existingLog.id,
      },
      data: {
        status: "DONE",
        source: "telegram",
        replyText,
        loggedAt,
      },
    });

    debug("HabitLog update result.", {
      habitLogId: updatedLog.id,
      userId: updatedLog.userId,
      habitId: updatedLog.habitId,
      status: updatedLog.status,
      source: updatedLog.source,
      replyText: updatedLog.replyText,
      loggedAt: updatedLog.loggedAt,
    });
    console.log(`Updated ${habit.code} log for ${user.email}.`);
    return;
  }

  const createdLog = await prisma.habitLog.create({
    data: {
      userId: user.id,
      habitId: habit.id,
      status: "DONE",
      source: "telegram",
      replyText,
      loggedAt,
    },
  });

  debug("HabitLog create result.", {
    habitLogId: createdLog.id,
    userId: createdLog.userId,
    habitId: createdLog.habitId,
    status: createdLog.status,
    source: createdLog.source,
    replyText: createdLog.replyText,
    loggedAt: createdLog.loggedAt,
  });
  console.log(`Logged ${habit.code} for ${user.email}.`);
}

export async function pollHabitReplies() {
  requireHabitBotToken();

  let offset = 0;

  debug("Polling started.", {
    offset,
    allowedUpdates: ["message"],
    timeoutSeconds: 30,
  });
  console.log("Telegram habit listener started. Press Ctrl+C to stop.");

  while (true) {
    const updates = await telegramRequest<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message"],
    });

    debug("Raw update count received.", {
      count: updates.length,
      offset,
      updateIds: updates.map((update) => update.update_id),
    });

    for (const update of updates) {
      offset = update.update_id + 1;

      if (!update.message) {
        debug("Skipping update without message.", {
          updateId: update.update_id,
        });
        continue;
      }

      try {
        await logHabitReply(update.message);
      } catch (error) {
        console.error("[telegram:habit] Caught error while processing update.", {
          updateId: update.update_id,
          error,
        });
      }
    }
  }
}

export async function testHabitBotConnection() {
  const bot = await telegramRequest<TelegramUser>("getMe");
  console.log(
    `Connected to Telegram habit bot: ${bot.first_name ?? bot.username ?? bot.id}`,
  );
}

export async function deleteHabitBotWebhook() {
  await telegramRequest<boolean>("deleteWebhook");
  console.log("Deleted Telegram habit bot webhook.");
}

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

function isMainModule() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false;
}

if (isMainModule()) {
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  if (process.argv.includes("--delete-webhook")) {
    deleteHabitBotWebhook()
      .catch((error) => {
        console.error("[telegram:habit] Caught error.", error);
        process.exit(1);
      })
      .finally(async () => {
        await prisma.$disconnect();
      });
  } else if (process.argv.includes("--test")) {
    testHabitBotConnection()
      .catch((error) => {
        console.error("[telegram:habit] Caught error.", error);
        process.exit(1);
      })
      .finally(async () => {
        await prisma.$disconnect();
      });
  } else {
    pollHabitReplies().catch(async (error) => {
      console.error("[telegram:habit] Caught error.", error);
      await prisma.$disconnect();
      process.exit(1);
    });
  }
}

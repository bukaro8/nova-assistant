import "dotenv/config";

import { prisma } from "../db/prisma";

type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name?: string;
  username?: string;
};

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

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

const token = process.env.TELEGRAM_HABIT_BOT_TOKEN?.trim();
const apiBaseUrl = token ? `https://api.telegram.org/bot${token}` : "";

function debug(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.log(`[telegram:habit] ${message}`, meta);
    return;
  }

  console.log(`[telegram:habit] ${message}`);
}

function requireHabitBotToken() {
  if (!token) {
    throw new Error(
      [
        "TELEGRAM_HABIT_BOT_TOKEN is missing.",
        "Add it to .env, then run one of:",
        "  npm run telegram:habit:test",
        "  npm run telegram:habit",
      ].join("\n"),
    );
  }
}

async function telegramRequest<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  requireHabitBotToken();

  const response = await fetch(`${apiBaseUrl}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json()) as TelegramResponse<T>;

  if (!response.ok || !payload.ok) {
    if (payload.description === "Unauthorized") {
      throw new Error(
        [
          "Telegram rejected TELEGRAM_HABIT_BOT_TOKEN as Unauthorized.",
          "Check that the value in .env is the exact token from BotFather and has no extra spaces.",
          "If you regenerated the token in BotFather, update .env and rerun the command.",
        ].join("\n"),
      );
    }

    throw new Error(
      payload.description ?? `Telegram request failed: ${method}`,
    );
  }

  return payload.result as T;
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

async function findOrClaimUser(chatId: string) {
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

  debug("No user found for telegramHabitChatId; looking for unclaimed user.", {
    chatId,
  });

  const unclaimedUser = await prisma.user.findFirst({
    where: {
      telegramHabitChatId: null,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!unclaimedUser) {
    debug("No unclaimed user available for Telegram habit chat.", {
      chatId,
    });
    return null;
  }

  const claimedUser = await prisma.user.update({
    where: {
      id: unclaimedUser.id,
    },
    data: {
      telegramHabitChatId: chatId,
    },
  });

  debug("User claimed for Telegram habit chat.", {
    chatId,
    userId: claimedUser.id,
    email: claimedUser.email,
  });

  return claimedUser;
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

  const user = await findOrClaimUser(chatId);

  if (!user) {
    console.warn(`No NOVA user available for Telegram habit chat ${chatId}.`);
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

async function pollHabitReplies() {
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

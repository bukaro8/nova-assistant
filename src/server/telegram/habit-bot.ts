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

const token = process.env.TELEGRAM_HABIT_BOT_TOKEN;
const apiBaseUrl = token ? `https://api.telegram.org/bot${token}` : "";

function requireHabitBotToken() {
  if (!token) {
    throw new Error("TELEGRAM_HABIT_BOT_TOKEN is required.");
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
    return existingUser;
  }

  const unclaimedUser = await prisma.user.findFirst({
    where: {
      telegramHabitChatId: null,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!unclaimedUser) {
    return null;
  }

  return prisma.user.update({
    where: {
      id: unclaimedUser.id,
    },
    data: {
      telegramHabitChatId: chatId,
    },
  });
}

async function logHabitReply(message: TelegramMessage) {
  const replyText = message.text?.trim();
  const chatId = String(message.chat.id);

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
    await prisma.habitLog.update({
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

    console.log(`Updated ${habit.code} log for ${user.email}.`);
    return;
  }

  await prisma.habitLog.create({
    data: {
      userId: user.id,
      habitId: habit.id,
      status: "DONE",
      source: "telegram",
      replyText,
      loggedAt,
    },
  });

  console.log(`Logged ${habit.code} for ${user.email}.`);
}

async function pollHabitReplies() {
  requireHabitBotToken();

  let offset = 0;

  console.log("Telegram habit listener started. Press Ctrl+C to stop.");

  while (true) {
    const updates = await telegramRequest<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message"],
    });

    for (const update of updates) {
      offset = update.update_id + 1;

      if (!update.message) {
        continue;
      }

      await logHabitReply(update.message);
    }
  }
}

export async function testHabitBotConnection() {
  const bot = await telegramRequest<TelegramUser>("getMe");
  console.log(
    `Connected to Telegram habit bot: ${bot.first_name ?? bot.username ?? bot.id}`,
  );
}

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

if (process.argv.includes("--test")) {
  testHabitBotConnection()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
} else {
  pollHabitReplies().catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
}

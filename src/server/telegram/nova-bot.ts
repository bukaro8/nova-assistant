import "dotenv/config";

import { pathToFileURL } from "node:url";

import { formatCurrency } from "@/lib/currency";

import { prisma } from "../db/prisma";
import {
  requireHabitBotToken,
  sendTelegramMessage,
  telegramRequest,
  type TelegramUser,
} from "./api";
import { claimTelegramConnectionCode, extractTelegramStartCode } from "./linking";

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

type ExpenseCategory =
  | "GROCERIES"
  | "FOOD"
  | "TRANSPORT"
  | "BILLS"
  | "SANDS"
  | "INCOME"
  | "SHOPPING"
  | "OTHER";

type ParsedExpense = {
  amount: string;
  description: string;
  rawText: string;
  expenseDate: Date;
  category: ExpenseCategory;
};

const UK_TIME_ZONE = "Europe/London";
const amountPattern = /^-?\d+(?:\.\d{1,2})?$/;
const startsWithNumberPattern = /^-?\d/;
const datePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const categoryRules: Array<{
  category: Exclude<ExpenseCategory, "INCOME" | "OTHER">;
  keywords: string[];
}> = [
  {
    category: "GROCERIES",
    keywords: ["aldi", "tesco", "sainsbury", "lidl", "asda", "morrisons"],
  },
  {
    category: "FOOD",
    keywords: ["coffee", "restaurant", "takeaway", "mcdonalds", "subway", "kfc"],
  },
  {
    category: "TRANSPORT",
    keywords: ["uber", "train", "bus", "petrol", "fuel"],
  },
  {
    category: "SHOPPING",
    keywords: ["amazon", "ebay", "paypal"],
  },
  {
    category: "SANDS",
    keywords: ["totalenergies"],
  },
];

function debug(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.log(`[telegram:nova] ${message}`, meta);
    return;
  }

  console.log(`[telegram:nova] ${message}`);
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

function getTodayUkDateParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return {
    day: Number(value("day")),
    month: Number(value("month")),
    year: Number(value("year")),
  };
}

function dateFromParts(day: number, month: number, year: number) {
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatExpenseDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function categorize(description: string, amount: string): ExpenseCategory {
  if (Number(amount) < 0) {
    return "INCOME";
  }

  const normalizedDescription = description.toLowerCase();

  for (const rule of categoryRules) {
    if (
      rule.keywords.some((keyword) => normalizedDescription.includes(keyword))
    ) {
      return rule.category;
    }
  }

  return "OTHER";
}

function parseOptionalDate(parts: string[]) {
  const lastPart = parts.at(-1);

  if (!lastPart) {
    const today = getTodayUkDateParts();
    return {
      descriptionParts: parts,
      expenseDate: dateFromParts(today.day, today.month, today.year),
    };
  }

  const dateMatch = lastPart.match(datePattern);

  if (!dateMatch) {
    const today = getTodayUkDateParts();
    return {
      descriptionParts: parts,
      expenseDate: dateFromParts(today.day, today.month, today.year),
    };
  }

  const [, day, month, year] = dateMatch;

  return {
    descriptionParts: parts.slice(0, -1),
    expenseDate: dateFromParts(Number(day), Number(month), Number(year)),
  };
}

function parseExpenseMessage(text: string): ParsedExpense | null {
  const rawText = text.trim();
  const parts = rawText.split(/\s+/);
  const amount = parts[0];

  if (!amount || !amountPattern.test(amount)) {
    return null;
  }

  const { descriptionParts, expenseDate } = parseOptionalDate(parts.slice(1));
  const description = descriptionParts.join(" ").trim();

  if (!description || !expenseDate) {
    return null;
  }

  return {
    amount,
    description,
    rawText,
    expenseDate,
    category: categorize(description, amount),
  };
}

function helpMessage() {
  return [
    "NOVA Assistant can help you from Telegram.",
    "",
    "Log habit: Study",
    "Log expense: 15.48 aldi",
    "Connect account: use the button in NOVA Settings",
  ].join("\n");
}

function unknownMessage() {
  return [
    "I could not understand that yet.",
    "",
    "Try:",
    "Study",
    "15.48 aldi",
    "",
    "Send /help for examples.",
  ].join("\n");
}

function invalidExpenseMessage() {
  return [
    "❌ Invalid expense format",
    "",
    "Try:",
    "15.48 aldi",
    "15.48 aldi 01/05/2026",
  ].join("\n");
}

function savedExpenseMessage(
  expense: ParsedExpense,
  currency: string | null | undefined,
) {
  return [
    "✅ Expense saved",
    "",
    `Amount: ${formatCurrency(Number(expense.amount), currency)}`,
    `Description: ${expense.description}`,
    `Category: ${expense.category}`,
    `Date: ${formatExpenseDate(expense.expenseDate)}`,
  ].join("\n");
}

async function findLinkedUser(chatId: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        {
          telegramHabitChatId: chatId,
        },
        {
          telegramExpenseChatId: chatId,
        },
      ],
    },
  });

  debug("User lookup result.", {
    chatId,
    userId: user?.id,
    email: user?.email,
  });

  return user;
}

async function handleStartCode(chatId: string, code: string) {
  const result = await claimTelegramConnectionCode({
    chatId,
    code,
    kind: "nova",
  });

  if (result.status === "linked") {
    await sendTelegramMessage(
      chatId,
      "✅ NOVA Assistant connected. You can now log habits and expenses here.",
    );
    console.log(`Linked NOVA Telegram chat ${chatId} to ${result.user.email}.`);
    return;
  }

  if (result.status === "already-linked") {
    await sendTelegramMessage(
      chatId,
      "This Telegram account is already connected to another NOVA account.",
    );
    console.warn(`NOVA Telegram chat ${chatId} is already linked elsewhere.`);
    return;
  }

  await sendTelegramMessage(
    chatId,
    "❌ Invalid or expired NOVA connection. Open NOVA Settings and try again.",
  );
  console.warn(`Invalid NOVA Telegram /start connection code from chat ${chatId}.`);
}

async function handleExpense({
  chatId,
  text,
  user,
}: {
  chatId: string;
  text: string;
  user: NonNullable<Awaited<ReturnType<typeof findLinkedUser>>>;
}) {
  if (!user.assistantExpenses) {
    await sendTelegramMessage(
      chatId,
      "Expense tracking is disabled. Enable it in NOVA Settings.",
    );
    return;
  }

  const parsedExpense = parseExpenseMessage(text);

  debug("Expense parse result.", {
    chatId,
    userId: user.id,
    parsed: parsedExpense
      ? {
          amount: parsedExpense.amount,
          description: parsedExpense.description,
          category: parsedExpense.category,
          expenseDate: parsedExpense.expenseDate,
        }
      : null,
  });

  if (!parsedExpense) {
    await sendTelegramMessage(chatId, invalidExpenseMessage());
    return;
  }

  const expense = await prisma.expense.create({
    data: {
      userId: user.id,
      amount: parsedExpense.amount,
      description: parsedExpense.description,
      category: parsedExpense.category,
      source: "telegram",
      rawText: parsedExpense.rawText,
      expenseDate: parsedExpense.expenseDate,
    },
  });

  debug("Expense create result.", {
    expenseId: expense.id,
    userId: expense.userId,
    amount: expense.amount,
    category: expense.category,
  });

  await sendTelegramMessage(
    chatId,
    savedExpenseMessage(parsedExpense, user.currency),
  );
}

async function findMatchingHabit(userId: string, replyText: string) {
  const normalizedReply = normalizeReply(replyText);
  const habits = await prisma.habit.findMany({
    where: {
      userId,
      active: true,
    },
  });

  const matchingHabits = habits.filter((candidate) =>
    candidate.validReplies.some(
      (validReply) => normalizeReply(validReply) === normalizedReply,
    ),
  );

  debug("Habit match result.", {
    userId,
    normalizedReply,
    activeHabitCount: habits.length,
    matchCount: matchingHabits.length,
    matchedHabitCodes: matchingHabits.map((habit) => habit.code),
  });

  return matchingHabits;
}

async function handleHabit({
  chatId,
  text,
  messageDate,
  user,
}: {
  chatId: string;
  text: string;
  messageDate: number;
  user: NonNullable<Awaited<ReturnType<typeof findLinkedUser>>>;
}) {
  const matchingHabits = await findMatchingHabit(user.id, text);

  if (matchingHabits.length === 0) {
    await sendTelegramMessage(chatId, unknownMessage());
    return;
  }

  if (!user.assistantHabits) {
    await sendTelegramMessage(
      chatId,
      "Habit reminders are disabled. Enable them in NOVA Settings.",
    );
    return;
  }

  if (matchingHabits.length > 1) {
    await sendTelegramMessage(
      chatId,
      "That reply matches more than one habit. Update your habit replies in NOVA Settings.",
    );
    return;
  }

  const [habit] = matchingHabits;
  const loggedAt = new Date(messageDate * 1000);
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
        replyText: text,
        loggedAt,
      },
    });

    debug("HabitLog update result.", {
      habitLogId: updatedLog.id,
      habitId: updatedLog.habitId,
      userId: updatedLog.userId,
    });

    await sendTelegramMessage(
      chatId,
      `✅ ${habit.name} already logged. Updated your reply.`,
    );
    return;
  }

  const createdLog = await prisma.habitLog.create({
    data: {
      userId: user.id,
      habitId: habit.id,
      status: "DONE",
      source: "telegram",
      replyText: text,
      loggedAt,
    },
  });

  debug("HabitLog create result.", {
    habitLogId: createdLog.id,
    habitId: createdLog.habitId,
    userId: createdLog.userId,
  });

  await sendTelegramMessage(chatId, `✅ ${habit.name} logged for today.`);
}

async function handleNovaMessage(message: TelegramMessage) {
  const chatId = String(message.chat.id);
  const text = message.text?.trim();

  debug("Incoming Telegram message.", {
    chatId,
    text: message.text,
    messageId: message.message_id,
    telegramDate: message.date,
  });

  if (!text) {
    debug("Ignoring non-text message.", { chatId });
    return;
  }

  const startCode = extractTelegramStartCode(text);

  if (startCode) {
    await handleStartCode(chatId, startCode);
    return;
  }

  if (/^\/help(?:@\w+)?$/i.test(text)) {
    await sendTelegramMessage(chatId, helpMessage());
    return;
  }

  const user = await findLinkedUser(chatId);

  if (!user) {
    await sendTelegramMessage(
      chatId,
      "Open NOVA Settings and tap Connect Telegram before logging habits or expenses.",
    );
    return;
  }

  if (startsWithNumberPattern.test(text)) {
    await handleExpense({ chatId, text, user });
    return;
  }

  await handleHabit({
    chatId,
    text,
    messageDate: message.date,
    user,
  });
}

export async function pollNovaReplies() {
  requireHabitBotToken();

  let offset = 0;

  debug("Polling started.", {
    offset,
    allowedUpdates: ["message"],
    timeoutSeconds: 30,
  });
  console.log("NOVA Telegram listener started. Press Ctrl+C to stop.");

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
        await handleNovaMessage(update.message);
      } catch (error) {
        console.error("[telegram:nova] Caught error while processing update.", {
          updateId: update.update_id,
          error,
        });
      }
    }
  }
}

export async function testNovaBotConnection() {
  const bot = await telegramRequest<TelegramUser>("getMe");
  console.log(
    `Connected to NOVA Telegram bot: ${bot.first_name ?? bot.username ?? bot.id}`,
  );
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

  if (process.argv.includes("--test")) {
    testNovaBotConnection()
      .catch((error) => {
        console.error("[telegram:nova] Caught error.", error);
        process.exit(1);
      })
      .finally(async () => {
        await prisma.$disconnect();
      });
  } else {
    pollNovaReplies().catch(async (error) => {
      console.error("[telegram:nova] Caught error.", error);
      await prisma.$disconnect();
      process.exit(1);
    });
  }
}

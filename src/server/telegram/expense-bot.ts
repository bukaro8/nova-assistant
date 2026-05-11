import "dotenv/config";

import { pathToFileURL } from "node:url";

import { formatCurrency } from "@/lib/currency";

import { prisma } from "../db/prisma";
import {
  requireExpenseBotToken,
  sendExpenseTelegramMessage,
  telegramExpenseRequest,
  type TelegramUser,
} from "./api";

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
    console.log(`[telegram:expense] ${message}`, meta);
    return;
  }

  console.log(`[telegram:expense] ${message}`);
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

function formatMoney(amount: string) {
  return formatCurrency(Number(amount));
}

function toDisplayDescription(description: string) {
  return description
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toDisplayCategory(category: ExpenseCategory) {
  return category.charAt(0) + category.slice(1).toLowerCase();
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
    return {
      descriptionParts: parts,
      expenseDate: dateFromParts(
        getTodayUkDateParts().day,
        getTodayUkDateParts().month,
        getTodayUkDateParts().year,
      ),
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

async function findOrClaimUser(chatId: string) {
  const existingUser = await prisma.user.findUnique({
    where: {
      telegramExpenseChatId: chatId,
    },
  });

  if (existingUser) {
    debug("User found by telegramExpenseChatId.", {
      chatId,
      userId: existingUser.id,
      email: existingUser.email,
    });
    return existingUser;
  }

  debug("No user found for telegramExpenseChatId; looking for unclaimed user.", {
    chatId,
  });

  const unclaimedUser = await prisma.user.findFirst({
    where: {
      telegramExpenseChatId: null,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!unclaimedUser) {
    debug("No unclaimed user available for Telegram expense chat.", {
      chatId,
    });
    return null;
  }

  const claimedUser = await prisma.user.update({
    where: {
      id: unclaimedUser.id,
    },
    data: {
      telegramExpenseChatId: chatId,
    },
  });

  debug("User claimed for Telegram expense chat.", {
    chatId,
    userId: claimedUser.id,
    email: claimedUser.email,
  });

  return claimedUser;
}

function invalidFormatMessage() {
  return [
    "❌ Invalid format",
    "",
    "Try:",
    "15.48 aldi",
    "15.48 aldi 01/05/2026",
  ].join("\n");
}

function savedExpenseMessage(expense: ParsedExpense) {
  return [
    "✅ Expense saved",
    "",
    formatMoney(expense.amount),
    toDisplayDescription(expense.description),
    `Category: ${toDisplayCategory(expense.category)}`,
    `Date: ${formatExpenseDate(expense.expenseDate)}`,
  ].join("\n");
}

async function handleExpenseMessage(message: TelegramMessage) {
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

  const parsedExpense = parseExpenseMessage(text);

  debug("Parse result.", {
    chatId,
    parsed: parsedExpense
      ? {
          amount: parsedExpense.amount,
          description: parsedExpense.description,
          category: parsedExpense.category,
          expenseDate: parsedExpense.expenseDate,
          rawText: parsedExpense.rawText,
        }
      : null,
  });

  if (!parsedExpense) {
    await sendExpenseTelegramMessage(chatId, invalidFormatMessage());
    console.warn(`Invalid expense format from chat ${chatId}: "${text}"`);
    return;
  }

  const user = await findOrClaimUser(chatId);

  if (!user) {
    console.warn(`No NOVA user available for Telegram expense chat ${chatId}.`);
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
    description: expense.description,
    category: expense.category,
    source: expense.source,
    rawText: expense.rawText,
    expenseDate: expense.expenseDate,
  });

  await sendExpenseTelegramMessage(chatId, savedExpenseMessage(parsedExpense));

  console.log(`Saved expense ${expense.id} for ${user.email}.`);
}

export async function pollExpenseReplies() {
  requireExpenseBotToken();

  let offset = 0;

  debug("Polling started.", {
    offset,
    allowedUpdates: ["message"],
    timeoutSeconds: 30,
  });
  console.log("Telegram expense listener started. Press Ctrl+C to stop.");

  while (true) {
    const updates = await telegramExpenseRequest<TelegramUpdate[]>(
      "getUpdates",
      {
        offset,
        timeout: 30,
        allowed_updates: ["message"],
      },
    );

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
        await handleExpenseMessage(update.message);
      } catch (error) {
        console.error(
          "[telegram:expense] Caught error while processing update.",
          {
            updateId: update.update_id,
            error,
          },
        );
      }
    }
  }
}

export async function testExpenseBotConnection() {
  const bot = await telegramExpenseRequest<TelegramUser>("getMe");
  console.log(
    `Connected to Telegram expense bot: ${bot.first_name ?? bot.username ?? bot.id}`,
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
    testExpenseBotConnection()
      .catch((error) => {
        console.error("[telegram:expense] Caught error.", error);
        process.exit(1);
      })
      .finally(async () => {
        await prisma.$disconnect();
      });
  } else {
    pollExpenseReplies().catch(async (error) => {
      console.error("[telegram:expense] Caught error.", error);
      await prisma.$disconnect();
      process.exit(1);
    });
  }
}

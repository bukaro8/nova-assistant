import "dotenv/config";

import { pathToFileURL } from "node:url";

import { formatCurrency } from "@/lib/currency";
import {
  invalidTelegramExpenseMessage,
  parseTelegramExpenseMessageForUser,
} from "@/server/expenses/parse-telegram-expense";

import { prisma } from "../db/prisma";
import {
  claimTelegramConnectionCode,
  extractTelegramStartCode,
  looksLikeTelegramConnectionCode,
  normalizeTelegramConnectionCode,
} from "./linking";
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

function debug(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.log(`[telegram:expense] ${message}`, meta);
    return;
  }

  console.log(`[telegram:expense] ${message}`);
}

function formatExpenseDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatMoney(amount: string, currency: string | null | undefined) {
  return formatCurrency(Number(amount), currency);
}

async function findLinkedUser(chatId: string) {
  debug("Looking up user by telegramExpenseChatId.", { chatId });

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

  debug("No user found for telegramExpenseChatId.", { chatId });
  return null;
}

function savedExpenseMessage(
  expense: {
    amount: string;
    description: string;
    category: string;
    expenseDate: Date;
    accountName?: string | null;
  },
  currency: string | null | undefined,
) {
  return [
    "✅ Expense saved",
    "",
    `Amount: ${formatMoney(expense.amount, currency)}`,
    `Description: ${expense.description}`,
    `Category: ${expense.category}`,
    `Account: ${expense.accountName ?? "Default account"}`,
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

  const startCode = extractTelegramStartCode(text);

  if (startCode) {
    const result = await claimTelegramConnectionCode({
      chatId,
      code: startCode,
      kind: "expense",
    });

    if (result.status === "linked") {
      await sendExpenseTelegramMessage(
        chatId,
        "✅ Telegram connected to NOVA expense tracking.",
      );
      console.log(
        `Linked Telegram expense chat ${chatId} to ${result.user.email}.`,
      );
      return;
    }

    if (result.status === "already-linked") {
      await sendExpenseTelegramMessage(
        chatId,
        "This Telegram account is already connected to another NOVA account.",
      );
      console.warn(`Telegram expense chat ${chatId} is already linked elsewhere.`);
      return;
    }

    await sendExpenseTelegramMessage(
      chatId,
      "❌ Invalid or expired NOVA connection code. Generate a new code in Settings.",
    );
    console.warn(
      `Invalid Telegram expense /start connection code from chat ${chatId}.`,
    );
    return;
  }

  const user = await findLinkedUser(chatId);

  if (!user) {
    if (looksLikeTelegramConnectionCode(text)) {
      const result = await claimTelegramConnectionCode({
        chatId,
        code: normalizeTelegramConnectionCode(text),
        kind: "expense",
      });

      if (result.status === "linked") {
        await sendExpenseTelegramMessage(
          chatId,
          "✅ Telegram connected to NOVA expense tracking.",
        );
        console.log(`Linked Telegram expense chat ${chatId} to ${result.user.email}.`);
        return;
      }

      if (result.status === "already-linked") {
        await sendExpenseTelegramMessage(
          chatId,
          "This Telegram account is already connected to another NOVA account.",
        );
        console.warn(`Telegram expense chat ${chatId} is already linked elsewhere.`);
        return;
      }

      await sendExpenseTelegramMessage(
        chatId,
        "❌ Invalid or expired NOVA connection code. Generate a new code in Settings.",
      );
      console.warn(`Invalid Telegram expense connection code from chat ${chatId}.`);
      return;
    }

    console.warn(`No NOVA user available for Telegram expense chat ${chatId}.`);
    await sendExpenseTelegramMessage(
      chatId,
      "Connect this chat from NOVA Settings before logging expenses.",
    );
    return;
  }

  const parsedExpense = await parseTelegramExpenseMessageForUser({
    userId: user.id,
    text,
  });

  debug("Parse result.", {
    chatId,
    parsed: parsedExpense.ok
      ? {
          amount: parsedExpense.expense.amount,
          description: parsedExpense.expense.description,
          category: parsedExpense.expense.category,
          expenseDate: parsedExpense.expense.expenseDate,
          rawText: parsedExpense.expense.rawText,
        }
      : null,
  });

  if (!parsedExpense.ok) {
    if (parsedExpense.reason === "unknown-account") {
      await sendExpenseTelegramMessage(
        chatId,
        `I couldn't find an account called '${parsedExpense.accountAlias}'. Add it in Settings → Accounts.`,
      );
      return;
    }

    await sendExpenseTelegramMessage(chatId, invalidTelegramExpenseMessage());
    console.warn(`Invalid expense format from chat ${chatId}: "${text}"`);
    return;
  }

  const expenseData = parsedExpense.expense;
  const expense = await prisma.expense.create({
    data: {
      userId: user.id,
      amount: expenseData.amount,
      description: expenseData.description,
      category: expenseData.category,
      confidence: expenseData.confidence,
      source: "telegram",
      rawText: expenseData.rawText,
      expenseDate: expenseData.expenseDate,
      accountId: expenseData.accountId,
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

  debug("Attempting Telegram expense confirmation send.", {
    chatId,
    expenseId: expense.id,
  });

  const confirmation = await sendExpenseTelegramMessage(
    chatId,
    savedExpenseMessage(expenseData, user.currency),
  );

  debug("Telegram expense confirmation result.", {
    chatId,
    expenseId: expense.id,
    messageId: confirmation.message_id,
  });

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

import "dotenv/config";

import { pathToFileURL } from "node:url";

import { formatCurrency } from "@/lib/currency";
import {
  invalidTelegramExpenseMessage,
  parseTelegramExpenseMessageForUser,
} from "@/server/expenses/parse-telegram-expense";
import { createAccountTransfer } from "@/server/accounts/transfers";

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

const TELEGRAM_DEBUG = process.env.NOVA_TELEGRAM_DEBUG === "true";

function debug(message: string, meta?: Record<string, unknown>) {
  if (!TELEGRAM_DEBUG) {
    return;
  }

  if (meta) {
    console.log(`[telegram:nova] ${message}`, meta);
    return;
  }

  console.log(`[telegram:nova] ${message}`);
}

function normalizeReply(text: string) {
  return text.trim().toLowerCase();
}

function normalizeIncomingText(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function isTransferCandidate(normalizedText: string) {
  const words = normalizedText.split(" ").filter(Boolean);

  return normalizedText.includes(" transfer ") || words[1] === "transfer";
}

function getLocalDayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function formatExpenseDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function helpMessage() {
  return [
    "🚀 NOVA Assistant",
    "",
    "📌 Habits",
    "study",
    "duta",
    "",
    "💸 Expenses",
    "10 milk",
    "milk 10",
    "10 milk barclays",
    "",
    "💰 Income",
    "179 wages barclays",
    "330 salary barclays",
    "",
    "🔁 Transfers",
    "50 transfer barclays paypal",
    "100 transfer cash barclays",
    "",
    "🏦 Accounts",
    "Use aliases like:",
    "barclays",
    "paypal",
    "cash",
    "",
    "⚙️ Tip",
    "If you don't specify an account,",
    "NOVA uses your default account.",
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

function transferValidationMessage(
  parsedExpense: Awaited<ReturnType<typeof parseTelegramExpenseMessageForUser>>,
) {
  if (!parsedExpense.ok) {
    if (parsedExpense.reason === "missing-transfer-account") {
      return "Please specify both accounts. Example: 50 transfer barclays pulse";
    }

    if (parsedExpense.reason === "same-transfer-account") {
      return "Source and destination accounts must be different.";
    }

    if (
      parsedExpense.reason === "invalid-transfer-amount" ||
      parsedExpense.reason === "missing-amount"
    ) {
      return "Transfer amount must be positive.";
    }

    if (parsedExpense.reason === "unknown-account") {
      return `I couldn't find an account called '${parsedExpense.accountAlias}'. Add it in Settings → Accounts.`;
    }
  }

  return [
    "I couldn't understand that transfer.",
    "",
    "Try:",
    "50 transfer barclays pulse",
  ].join("\n");
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
    `Amount: ${formatCurrency(Number(expense.amount), currency)}`,
    `Description: ${expense.description}`,
    `Category: ${expense.category}`,
    `Account: ${expense.accountName ?? "Default account"}`,
    `Date: ${formatExpenseDate(expense.expenseDate)}`,
  ].join("\n");
}

function savedTransferMessage(
  transfer: {
    amount: string;
    fromAccountName: string;
    toAccountName: string;
  },
  currency: string | null | undefined,
) {
  return [
    "✅ Transfer saved",
    "",
    `Amount: ${formatCurrency(Number(transfer.amount), currency)}`,
    `From: ${transfer.fromAccountName}`,
    `To: ${transfer.toAccountName}`,
  ].join("\n");
}

async function saveTransfer({
  chatId,
  transferData,
  user,
}: {
  chatId: string;
  transferData: {
    amount: string;
    rawText: string;
    expenseDate: Date;
    fromAccountId: string;
    fromAccountName: string;
    toAccountId: string;
    toAccountName: string;
  };
  user: NonNullable<Awaited<ReturnType<typeof findLinkedUser>>>;
}) {
  await createAccountTransfer({
    userId: user.id,
    amount: transferData.amount,
    fromAccount: {
      id: transferData.fromAccountId,
      name: transferData.fromAccountName,
    },
    toAccount: {
      id: transferData.toAccountId,
      name: transferData.toAccountName,
    },
    rawText: transferData.rawText,
    source: "telegram",
    createdVia: "telegram",
    expenseDate: transferData.expenseDate,
  });

  await sendTelegramMessage(
    chatId,
    savedTransferMessage(transferData, user.currency),
  );
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
    console.log("Linked NOVA Telegram chat.");
    return;
  }

  if (result.status === "already-linked") {
    await sendTelegramMessage(
      chatId,
      "This Telegram account is already connected to another NOVA account.",
    );
    console.warn("NOVA Telegram chat is already linked elsewhere.");
    return;
  }

  await sendTelegramMessage(
    chatId,
    "❌ Invalid or expired NOVA connection. Open NOVA Settings and try again.",
  );
  console.warn("Invalid NOVA Telegram /start connection code.");
}

async function handleTransfer({
  chatId,
  text,
  user,
}: {
  chatId: string;
  text: string;
  user: NonNullable<Awaited<ReturnType<typeof findLinkedUser>>>;
}): Promise<"saved" | "rejected" | "disabled"> {
  debug("Transfer parser attempted.", {
    chatId,
    userId: user.id,
    transferParserAttempted: true,
  });

  const parsedExpense = await parseTelegramExpenseMessageForUser({
    userId: user.id,
    text,
  });
  const transferMatched = parsedExpense.ok && parsedExpense.type === "transfer";
  const rejectionReason = parsedExpense.ok
    ? transferMatched
      ? null
      : "not-transfer"
    : parsedExpense.reason;

  debug("Transfer parser result.", {
    chatId,
    userId: user.id,
    transferParserAttempted: true,
    transferParserMatched: transferMatched,
    transferParserRejectedReason: rejectionReason,
  });

  if (!transferMatched) {
    await sendTelegramMessage(chatId, transferValidationMessage(parsedExpense));
    return "rejected";
  }

  if (!user.assistantExpenses) {
    debug("Transfer parser succeeded but expense tracking is disabled.", {
      chatId,
      userId: user.id,
    });
    await sendTelegramMessage(
      chatId,
      "Expense tracking is disabled. Enable it in NOVA Settings.",
    );
    return "disabled";
  }

  await saveTransfer({
    chatId,
    transferData: parsedExpense.transfer,
    user,
  });

  return "saved";
}

async function handleExpense({
  chatId,
  text,
  user,
}: {
  chatId: string;
  text: string;
  user: NonNullable<Awaited<ReturnType<typeof findLinkedUser>>>;
}): Promise<"saved" | "not-expense" | "rejected" | "disabled"> {
  debug("Expense parser attempted.", {
    chatId,
    userId: user.id,
    text,
  });
  const parsedExpense = await parseTelegramExpenseMessageForUser({
    userId: user.id,
    text,
  });

  debug("Expense parse result.", {
    chatId,
    userId: user.id,
    parsed: parsedExpense.ok
      ? parsedExpense.type === "expense"
        ? {
            type: parsedExpense.type,
            amount: parsedExpense.expense.amount,
            description: parsedExpense.expense.description,
            category: parsedExpense.expense.category,
            confidence: parsedExpense.expense.confidence,
            matchedKeyword: parsedExpense.expense.matchedKeyword,
            expenseDate: parsedExpense.expense.expenseDate,
          }
        : {
            type: parsedExpense.type,
            amount: parsedExpense.transfer.amount,
            from: parsedExpense.transfer.fromAccountName,
            to: parsedExpense.transfer.toAccountName,
            expenseDate: parsedExpense.transfer.expenseDate,
          }
      : null,
    ok: parsedExpense.ok,
    rejectionReason: parsedExpense.ok ? null : parsedExpense.reason,
  });

  if (!parsedExpense.ok) {
    if (parsedExpense.reason === "missing-transfer-account") {
      await sendTelegramMessage(
        chatId,
        "Please specify both accounts. Example: 50 transfer barclays pulse",
      );
      return "rejected";
    }

    if (parsedExpense.reason === "same-transfer-account") {
      await sendTelegramMessage(
        chatId,
        "Source and destination accounts must be different.",
      );
      return "rejected";
    }

    if (parsedExpense.reason === "invalid-transfer-amount") {
      await sendTelegramMessage(chatId, "Transfer amount must be positive.");
      return "rejected";
    }

    if (parsedExpense.reason === "unknown-account") {
      await sendTelegramMessage(
        chatId,
        `I couldn't find an account called '${parsedExpense.accountAlias}'. Add it in Settings → Accounts.`,
      );
      return "rejected";
    }

    if (parsedExpense.reason === "missing-amount") {
      return "not-expense";
    }

    await sendTelegramMessage(chatId, invalidTelegramExpenseMessage());
    return "rejected";
  }

  if (!user.assistantExpenses) {
    debug("Expense parser succeeded but expense tracking is disabled.", {
      chatId,
      userId: user.id,
    });
    await sendTelegramMessage(
      chatId,
      "Expense tracking is disabled. Enable it in NOVA Settings.",
    );
    return "disabled";
  }

  if (parsedExpense.type === "transfer") {
    await saveTransfer({
      chatId,
      transferData: parsedExpense.transfer,
      user,
    });

    return "saved";
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
    category: expense.category,
  });

  await sendTelegramMessage(
    chatId,
    savedExpenseMessage(expenseData, user.currency),
  );

  return "saved";
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
  matchingHabits,
}: {
  chatId: string;
  text: string;
  messageDate: number;
  user: NonNullable<Awaited<ReturnType<typeof findLinkedUser>>>;
  matchingHabits?: Awaited<ReturnType<typeof findMatchingHabit>>;
}) {
  matchingHabits ??= await findMatchingHabit(user.id, text);

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
  const normalizedText = text ? normalizeIncomingText(text) : "";

  debug("Incoming Telegram message.", {
    chatId,
    rawText: message.text,
    text,
    normalizedText,
    messageId: message.message_id,
    telegramDate: message.date,
  });

  if (!text) {
    debug("Ignoring non-text message.", { chatId });
    return;
  }

  const startCode = extractTelegramStartCode(text);
  const startMatched = Boolean(startCode);

  debug("Start command match result.", {
    chatId,
    matched: startMatched,
    hasCode: startMatched,
  });

  if (startCode) {
    await handleStartCode(chatId, startCode);
    return;
  }

  const helpMatched = /^\/help(?:@\w+)?$/i.test(text);

  debug("Help command match result.", {
    chatId,
    matched: helpMatched,
  });

  if (helpMatched) {
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

  const matchingHabits = await findMatchingHabit(user.id, text);
  const habitMatched = matchingHabits.length > 0;
  const transferCandidate = isTransferCandidate(normalizedText);

  debug("Priority decision after habit match.", {
    chatId,
    userId: user.id,
    habitMatched,
    habitMatchCount: matchingHabits.length,
    transferParserWillBeAttempted: !habitMatched && transferCandidate,
    expenseParserWillBeAttempted: !habitMatched && !transferCandidate,
  });

  if (habitMatched) {
    await handleHabit({
      chatId,
      text,
      messageDate: message.date,
      user,
      matchingHabits,
    });
    return;
  }

  if (transferCandidate) {
    const transferResult = await handleTransfer({ chatId, text, user });

    debug("Post-transfer parser routing result.", {
      chatId,
      result: transferResult,
      expenseParserSkipped: true,
    });

    return;
  }

  const expenseResult = await handleExpense({ chatId, text, user });

  debug("Post-expense parser routing result.", {
    chatId,
    result: expenseResult,
    fallbackUsed: expenseResult === "not-expense",
  });

  if (expenseResult === "not-expense") {
    await sendTelegramMessage(chatId, unknownMessage());
  }
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

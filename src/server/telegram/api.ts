import "dotenv/config";

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name?: string;
  username?: string;
};

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

const novaToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
const token =
  novaToken ||
  process.env.TELEGRAM_HABIT_BOT_TOKEN?.trim() ||
  process.env.TELEGRAM_EXPENSE_BOT_TOKEN?.trim();
const apiBaseUrl = token ? `https://api.telegram.org/bot${token}` : "";
const expenseToken =
  novaToken ||
  process.env.TELEGRAM_EXPENSE_BOT_TOKEN?.trim() ||
  process.env.TELEGRAM_HABIT_BOT_TOKEN?.trim();
const expenseApiBaseUrl = expenseToken
  ? `https://api.telegram.org/bot${expenseToken}`
  : "";
const tokenEnvName = novaToken
  ? "TELEGRAM_BOT_TOKEN"
  : process.env.TELEGRAM_HABIT_BOT_TOKEN?.trim()
    ? "TELEGRAM_HABIT_BOT_TOKEN"
    : "TELEGRAM_EXPENSE_BOT_TOKEN";
const expenseTokenEnvName = novaToken
  ? "TELEGRAM_BOT_TOKEN"
  : process.env.TELEGRAM_EXPENSE_BOT_TOKEN?.trim()
    ? "TELEGRAM_EXPENSE_BOT_TOKEN"
    : "TELEGRAM_HABIT_BOT_TOKEN";

export function requireHabitBotToken() {
  if (!token) {
    throw new Error(
      [
        "TELEGRAM_BOT_TOKEN or TELEGRAM_HABIT_BOT_TOKEN is missing.",
        "Add it to .env, then run one of:",
        "  npm run telegram:nova:test",
        "  npm run telegram:nova",
        "  npm run telegram:habit:test",
        "  npm run telegram:habit",
        "  npm run telegram:habit:scheduler",
      ].join("\n"),
    );
  }
}

export function requireExpenseBotToken() {
  if (!expenseToken) {
    throw new Error(
      [
        "TELEGRAM_BOT_TOKEN or TELEGRAM_EXPENSE_BOT_TOKEN is missing.",
        "Add it to .env, then run one of:",
        "  npm run telegram:nova:test",
        "  npm run telegram:nova",
        "  npm run telegram:expense:test",
        "  npm run telegram:expense",
      ].join("\n"),
    );
  }
}

async function requestTelegram<T>(
  botApiBaseUrl: string,
  tokenEnvName: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${botApiBaseUrl}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json()) as TelegramResponse<T>;

  if (!response.ok || !payload.ok) {
    if (payload.description === "Unauthorized") {
      throw new Error(
        [
          `Telegram rejected ${tokenEnvName} as Unauthorized.`,
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

export async function telegramRequest<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  requireHabitBotToken();

  return requestTelegram<T>(
    apiBaseUrl,
    tokenEnvName,
    method,
    body,
  );
}

export async function telegramExpenseRequest<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  requireExpenseBotToken();

  return requestTelegram<T>(
    expenseApiBaseUrl,
    expenseTokenEnvName,
    method,
    body,
  );
}

export async function sendTelegramMessage(chatId: string, text: string) {
  return telegramRequest<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
  });
}

export async function sendExpenseTelegramMessage(chatId: string, text: string) {
  return telegramExpenseRequest<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
  });
}

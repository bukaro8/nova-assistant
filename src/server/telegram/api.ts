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

const token = process.env.TELEGRAM_HABIT_BOT_TOKEN?.trim();
const apiBaseUrl = token ? `https://api.telegram.org/bot${token}` : "";

export function requireHabitBotToken() {
  if (!token) {
    throw new Error(
      [
        "TELEGRAM_HABIT_BOT_TOKEN is missing.",
        "Add it to .env, then run one of:",
        "  npm run telegram:habit:test",
        "  npm run telegram:habit",
        "  npm run telegram:habit:scheduler",
      ].join("\n"),
    );
  }
}

export async function telegramRequest<T>(
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

export async function sendTelegramMessage(chatId: string, text: string) {
  return telegramRequest<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
  });
}

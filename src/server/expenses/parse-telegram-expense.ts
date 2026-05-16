import {
  categoriseExpense,
  categoriseExpenseForUser,
  type ExpenseCategorisation,
  type ExpenseCategoryRuleInput,
  type ExpenseCategoryValue,
} from "@/server/expenses/categorise-expense";

type ParsedTelegramExpense = {
  amount: string;
  description: string;
  rawText: string;
  expenseDate: Date;
  category: ExpenseCategoryValue;
  confidence: number;
  matchedKeyword: string | null;
};

type ParseTelegramExpenseResult =
  | {
      ok: true;
      expense: ParsedTelegramExpense;
    }
  | {
      ok: false;
      reason: "missing-amount" | "missing-description" | "invalid-date";
    };

const UK_TIME_ZONE = "Europe/London";
const datePattern = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
const amountPattern = /(^|[^a-z0-9/.])(-?\d+(?:\.\d{1,2})?)(?![a-z0-9/.])/;

function collapseSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

function parseDate(text: string) {
  const match = text.match(datePattern);

  if (!match || match.index === undefined) {
    const today = getTodayUkDateParts();
    return {
      ok: true as const,
      textWithoutDate: text,
      expenseDate: dateFromParts(today.day, today.month, today.year),
    };
  }

  const [, day, month, year] = match;
  const expenseDate = dateFromParts(Number(day), Number(month), Number(year));

  if (!expenseDate) {
    return {
      ok: false as const,
    };
  }

  return {
    ok: true as const,
    textWithoutDate: `${text.slice(0, match.index)} ${text.slice(
      match.index + match[0].length,
    )}`,
    expenseDate,
  };
}

function parseAmount(text: string) {
  const match = text.match(amountPattern);

  if (!match || match.index === undefined) {
    return null;
  }

  const prefix = match[1] ?? "";
  const amount = match[2];
  const start = match.index + prefix.length;
  const end = start + amount.length;

  return {
    amount,
    textWithoutAmount: `${text.slice(0, start)} ${text.slice(end)}`,
  };
}

function buildParsedExpense({
  rawText,
  amount,
  description,
  expenseDate,
  categorisation,
}: {
  rawText: string;
  amount: string;
  description: string;
  expenseDate: Date;
  categorisation: ExpenseCategorisation;
}): ParsedTelegramExpense {
  return {
    amount,
    description,
    rawText,
    expenseDate,
    category: categorisation.category,
    confidence: categorisation.confidence,
    matchedKeyword: categorisation.matchedKeyword,
  };
}

export function parseTelegramExpenseMessage({
  text,
  userRules = [],
}: {
  text: string;
  userRules?: ExpenseCategoryRuleInput[];
}): ParseTelegramExpenseResult {
  const rawText = text.trim();
  const parsedDate = parseDate(rawText);

  if (!parsedDate.ok || !parsedDate.expenseDate) {
    return {
      ok: false,
      reason: "invalid-date",
    };
  }

  const parsedAmount = parseAmount(parsedDate.textWithoutDate);

  if (!parsedAmount) {
    return {
      ok: false,
      reason: "missing-amount",
    };
  }

  const description = collapseSpaces(parsedAmount.textWithoutAmount);

  if (!description) {
    return {
      ok: false,
      reason: "missing-description",
    };
  }

  const categorisation = categoriseExpense({
    text: description,
    amount: parsedAmount.amount,
    userRules,
  });

  return {
    ok: true,
    expense: buildParsedExpense({
      rawText,
      amount: parsedAmount.amount,
      description,
      expenseDate: parsedDate.expenseDate,
      categorisation,
    }),
  };
}

export async function parseTelegramExpenseMessageForUser({
  userId,
  text,
}: {
  userId: string;
  text: string;
}): Promise<ParseTelegramExpenseResult> {
  const rawText = text.trim();
  const parsedDate = parseDate(rawText);

  if (!parsedDate.ok || !parsedDate.expenseDate) {
    return {
      ok: false,
      reason: "invalid-date",
    };
  }

  const parsedAmount = parseAmount(parsedDate.textWithoutDate);

  if (!parsedAmount) {
    return {
      ok: false,
      reason: "missing-amount",
    };
  }

  const description = collapseSpaces(parsedAmount.textWithoutAmount);

  if (!description) {
    return {
      ok: false,
      reason: "missing-description",
    };
  }

  const categorisation = await categoriseExpenseForUser({
    userId,
    text: description,
    amount: parsedAmount.amount,
  });

  return {
    ok: true,
    expense: buildParsedExpense({
      rawText,
      amount: parsedAmount.amount,
      description,
      expenseDate: parsedDate.expenseDate,
      categorisation,
    }),
  };
}

export function invalidTelegramExpenseMessage() {
  return [
    "I couldn't understand that expense.",
    "",
    "Try:",
    "10 milk",
    "milk 10",
    "15.48 aldi",
  ].join("\n");
}

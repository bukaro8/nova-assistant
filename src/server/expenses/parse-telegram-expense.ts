import {
  categoriseExpense,
  normaliseExpenseText,
  type ExpenseCategorisation,
  type ExpenseCategoryRuleInput,
  type ExpenseCategoryValue,
} from "@/server/expenses/categorise-expense";
import type { AccountForSelection } from "@/server/accounts/accounts";

type ParsedTelegramExpense = {
  amount: string;
  description: string;
  rawText: string;
  expenseDate: Date;
  category: ExpenseCategoryValue;
  confidence: number;
  matchedKeyword: string | null;
  accountId?: string | null;
  accountName?: string | null;
};

type ParsedTelegramTransfer = {
  amount: string;
  rawText: string;
  expenseDate: Date;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
};

type ParseTelegramExpenseResult =
  | {
      ok: true;
      type: "expense";
      expense: ParsedTelegramExpense;
    }
  | {
      ok: true;
      type: "transfer";
      transfer: ParsedTelegramTransfer;
    }
  | {
      ok: false;
      reason:
        | "missing-amount"
        | "missing-description"
        | "invalid-date"
        | "unknown-account"
        | "missing-transfer-account"
        | "same-transfer-account"
        | "invalid-transfer-amount";
      accountAlias?: string;
    };

const UK_TIME_ZONE = "Europe/London";
const datePattern = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
const amountPattern = /(^|[^a-z0-9/.])(-?\d+(?:\.\d{1,2})?)(?![a-z0-9/.])/;
const transferCommandWords = new Set(["move", "moved", "pay", "paid"]);
const transferFillerWords = new Set([
  "from",
  "into",
  "move",
  "moved",
  "paid",
  "pay",
  "to",
  "transfer",
]);
const commonAccountAliasHints = new Set([
  "amex",
  "bank",
  "barclays",
  "card",
  "cash",
  "chase",
  "halifax",
  "hsbc",
  "lloyds",
  "mastercard",
  "monzo",
  "nationwide",
  "natwest",
  "paypal",
  "pulse",
  "revolut",
  "santander",
  "starling",
  "unknown",
  "visa",
]);

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
  accountId,
  accountName,
}: {
  rawText: string;
  amount: string;
  description: string;
  expenseDate: Date;
  categorisation: ExpenseCategorisation;
  accountId?: string | null;
  accountName?: string | null;
}): ParsedTelegramExpense {
  return {
    amount,
    description,
    rawText,
    expenseDate,
    category: categorisation.category,
    confidence: categorisation.confidence,
    matchedKeyword: categorisation.matchedKeyword,
    accountId,
    accountName,
  };
}

function unknownAccountAliasCandidate({
  description,
  amount,
  userRules,
}: {
  description: string;
  amount: string;
  userRules: ExpenseCategoryRuleInput[];
}) {
  const words = description.split(/\s+/).filter(Boolean);

  if (words.length < 2) {
    return null;
  }

  for (let size = Math.min(3, words.length - 1); size >= 1; size -= 1) {
    const prefix = words.slice(0, -size).join(" ");
    const suffix = words.slice(-size).join(" ");
    const normalisedSuffix = normaliseExpenseText(suffix);

    if (
      !prefix ||
      !suffix ||
      (!suffix.startsWith("@") && !commonAccountAliasHints.has(normalisedSuffix))
    ) {
      continue;
    }

    const prefixCategorisation = categoriseExpense({
      text: prefix,
      amount,
      userRules,
    });
    const suffixCategorisation = categoriseExpense({
      text: suffix,
      amount: "1",
      userRules,
    });

    if (
      prefixCategorisation.category !== "OTHER" &&
      suffixCategorisation.category === "OTHER"
    ) {
      return suffix;
    }
  }

  return null;
}

function aliasWordMatch(words: string[], index: number, alias: string) {
  const aliasWords = alias.split(" ").filter(Boolean);

  if (aliasWords.length === 0) {
    return false;
  }

  return aliasWords.every((word, offset) => words[index + offset] === word);
}

function matchTransferAccountAt({
  words,
  index,
  accounts,
}: {
  words: string[];
  index: number;
  accounts: AccountForSelection[];
}) {
  const matches = accounts.flatMap((account) =>
    account.aliases
      .map((alias) => normaliseExpenseText(alias))
      .filter(Boolean)
      .filter((alias) => aliasWordMatch(words, index, alias))
      .map((alias) => ({
        account,
        alias,
        wordCount: alias.split(" ").filter(Boolean).length,
      })),
  );

  return matches.toSorted((a, b) => {
    const wordDiff = b.wordCount - a.wordCount;

    if (wordDiff !== 0) {
      return wordDiff;
    }

    return b.alias.length - a.alias.length;
  })[0] ?? null;
}

function parseTransferAccounts({
  description,
  accounts,
}: {
  description: string;
  accounts: AccountForSelection[];
}) {
  const normalised = normaliseExpenseText(description);
  const words = normalised.split(" ").filter(Boolean);
  const hasTransferKeyword = words.includes("transfer");
  const hasMoveOrPayCommand =
    Boolean(words[0]) &&
    transferCommandWords.has(words[0]) &&
    words.includes("from") &&
    (words.includes("to") || words.includes("into"));

  if (!hasTransferKeyword && !hasMoveOrPayCommand) {
    return null;
  }

  const accountWords = words.filter((word) => !transferFillerWords.has(word));

  if (accountWords.length === 0) {
    return {
      ok: false as const,
      reason: "missing-transfer-account" as const,
    };
  }

  const fromMatch = matchTransferAccountAt({
    words: accountWords,
    index: 0,
    accounts,
  });

  if (!fromMatch) {
    return {
      ok: false as const,
      reason: "unknown-account" as const,
      accountAlias: accountWords[0],
    };
  }

  const toIndex = fromMatch.wordCount;
  const toMatch = matchTransferAccountAt({
    words: accountWords,
    index: toIndex,
    accounts,
  });

  if (!toMatch) {
    if (!accountWords[toIndex]) {
      return {
        ok: false as const,
        reason: "missing-transfer-account" as const,
      };
    }

    return {
      ok: false as const,
      reason: "unknown-account" as const,
      accountAlias: accountWords[toIndex],
    };
  }

  if (fromMatch.account.id === toMatch.account.id) {
    return {
      ok: false as const,
      reason: "same-transfer-account" as const,
    };
  }

  return {
    ok: true as const,
    fromAccount: fromMatch.account,
    toAccount: toMatch.account,
  };
}

export function parseTelegramExpenseMessage({
  accounts = [],
  text,
  userRules = [],
}: {
  accounts?: AccountForSelection[];
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

  if (accounts.length > 0) {
    const transferMatch = parseTransferAccounts({
      description,
      accounts,
    });

    if (transferMatch) {
      if (!transferMatch.ok) {
        return {
          ok: false,
          reason: transferMatch.reason,
          accountAlias:
            "accountAlias" in transferMatch ? transferMatch.accountAlias : undefined,
        };
      }

      if (Number(parsedAmount.amount) <= 0) {
        return {
          ok: false,
          reason: "invalid-transfer-amount",
        };
      }

      return {
        ok: true,
        type: "transfer",
        transfer: {
          amount: parsedAmount.amount,
          rawText,
          expenseDate: parsedDate.expenseDate,
          fromAccountId: transferMatch.fromAccount.id,
          fromAccountName: transferMatch.fromAccount.name,
          toAccountId: transferMatch.toAccount.id,
          toAccountName: transferMatch.toAccount.name,
        },
      };
    }
  }

  const categorisation = categoriseExpense({
    text: description,
    amount: parsedAmount.amount,
    userRules,
  });

  return {
    ok: true,
    type: "expense",
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

  const descriptionWithPossibleAccount = collapseSpaces(
    parsedAmount.textWithoutAmount,
  );

  if (!descriptionWithPossibleAccount) {
    return {
      ok: false,
      reason: "missing-description",
    };
  }

  const [{ prisma }, accountHelpers] = await Promise.all([
    import("@/server/db/prisma"),
    import("@/server/accounts/accounts"),
  ]);
  const [userRules, accounts] = await Promise.all([
    prisma.expenseCategoryRule.findMany({
      where: {
        userId,
      },
      select: {
        category: true,
        keyword: true,
      },
    }),
    accountHelpers.getActiveAccountsForUser(userId),
  ]);
  const transferMatch = parseTransferAccounts({
    description: descriptionWithPossibleAccount,
    accounts,
  });

  if (transferMatch) {
    if (!transferMatch.ok) {
      return {
        ok: false,
        reason: transferMatch.reason,
        accountAlias: "accountAlias" in transferMatch ? transferMatch.accountAlias : undefined,
      };
    }

    if (Number(parsedAmount.amount) <= 0) {
      return {
        ok: false,
        reason: "invalid-transfer-amount",
      };
    }

    return {
      ok: true,
      type: "transfer",
      transfer: {
        amount: parsedAmount.amount,
        rawText,
        expenseDate: parsedDate.expenseDate,
        fromAccountId: transferMatch.fromAccount.id,
        fromAccountName: transferMatch.fromAccount.name,
        toAccountId: transferMatch.toAccount.id,
        toAccountName: transferMatch.toAccount.name,
      },
    };
  }

  const accountMatch = accountHelpers.findAccountAliasInText({
    text: descriptionWithPossibleAccount,
    accounts,
  });
  const account =
    accountMatch?.account ?? accounts.find((candidate) => candidate.isDefault);
  const description = accountMatch
    ? collapseSpaces(
        accountHelpers.removeAccountAliasFromText({
          text: descriptionWithPossibleAccount,
          alias: accountMatch.alias,
        }),
      )
    : descriptionWithPossibleAccount;

  if (!description) {
    return {
      ok: false,
      reason: "missing-description",
    };
  }

  if (!accountMatch) {
    const unknownAlias = unknownAccountAliasCandidate({
      description: descriptionWithPossibleAccount,
      amount: parsedAmount.amount,
      userRules,
    });

    if (unknownAlias) {
      return {
        ok: false,
        reason: "unknown-account",
        accountAlias: unknownAlias,
      };
    }
  }

  const categorisation = categoriseExpense({
    text: description,
    amount: parsedAmount.amount,
    userRules,
  });

  return {
    ok: true,
    type: "expense",
    expense: buildParsedExpense({
      rawText,
      amount: parsedAmount.amount,
      description,
      expenseDate: parsedDate.expenseDate,
      categorisation,
      accountId: account?.id ?? null,
      accountName: account?.name ?? null,
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

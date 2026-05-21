import { prisma } from "@/server/db/prisma";
import {
  normaliseAccountAlias,
} from "@/lib/account-aliases";
import { ExpenseCategory } from "@/generated/prisma/enums";

export type AccountForSelection = {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  isDefault: boolean;
  isActive: boolean;
};

export type AccountWithBalance = AccountForSelection & {
  openingBalance: unknown;
  dueDay: number | null;
  createdAt: Date;
  updatedAt: Date;
  expenseCount: number;
  balance: number;
};

export type AccountBalanceEntry = {
  amount: unknown;
  category: string | null;
};

function accountBalanceMovement(entry: AccountBalanceEntry) {
  const amount = Number(entry.amount);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  if (entry.category === ExpenseCategory.INCOME) {
    return Math.abs(amount);
  }

  if (entry.category === ExpenseCategory.TRANSFER) {
    return -amount;
  }

  if (amount < 0) {
    return Math.abs(amount);
  }

  return -amount;
}

export function calculateAccountBalance({
  openingBalance,
  entries,
}: {
  openingBalance: unknown;
  entries: AccountBalanceEntry[];
}) {
  const movementTotal = entries.reduce<number>(
    (total, entry) => total + accountBalanceMovement(entry),
    0,
  );

  return Number(openingBalance) + movementTotal;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function ensureDefaultAccount(userId: string) {
  const accounts = await prisma.account.findMany({
    where: {
      userId,
    },
    orderBy: [
      {
        isDefault: "desc",
      },
      {
        createdAt: "asc",
      },
    ],
  });

  const existingDefault = accounts.find((account) => account.isDefault);

  if (existingDefault) {
    return existingDefault;
  }

  if (accounts.length === 0) {
    try {
      return await prisma.account.create({
        data: {
          userId,
          name: "Cash",
          type: "CASH",
          aliases: ["cash"],
          openingBalance: "0",
          isDefault: true,
          isActive: true,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const account = await prisma.account.findFirst({
        where: {
          userId,
          isDefault: true,
        },
      });

      if (account) {
        return account;
      }

      throw error;
    }
  }

  const fallback = accounts.find((account) => account.isActive) ?? accounts[0];

  await prisma.account.update({
    where: {
      id: fallback.id,
    },
    data: {
      isDefault: true,
      isActive: true,
    },
  });

  return {
    ...fallback,
    isDefault: true,
    isActive: true,
  };
}

export async function getActiveAccountsForUser(userId: string) {
  await ensureDefaultAccount(userId);

  return prisma.account.findMany({
    where: {
      userId,
      isActive: true,
    },
    orderBy: [
      {
        isDefault: "desc",
      },
      {
        name: "asc",
      },
    ],
  });
}

export async function getAccountOrDefault({
  userId,
  accountId,
}: {
  userId: string;
  accountId?: string | null;
}) {
  if (accountId) {
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId,
        isActive: true,
      },
    });

    if (account) {
      return account;
    }
  }

  return ensureDefaultAccount(userId);
}

export async function getAccountsWithBalances(userId: string) {
  await ensureDefaultAccount(userId);

  const accounts = await prisma.account.findMany({
    where: {
      userId,
    },
    include: {
      expenses: {
        select: {
          amount: true,
          category: true,
        },
      },
      _count: {
        select: {
          expenses: true,
        },
      },
    },
    orderBy: [
      {
        isDefault: "desc",
      },
      {
        isActive: "desc",
      },
      {
        name: "asc",
      },
    ],
  });

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    aliases: account.aliases,
    openingBalance: account.openingBalance,
    dueDay: account.dueDay,
    isDefault: account.isDefault,
    isActive: account.isActive,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    expenseCount: account._count.expenses,
    balance: calculateAccountBalance({
      openingBalance: account.openingBalance,
      entries: account.expenses.map((expense) => ({
        amount: expense.amount,
        category: expense.category,
      })),
    }),
  }));
}

export async function assertAliasesAreUniqueForUser({
  userId,
  aliases,
  excludeAccountId,
}: {
  userId: string;
  aliases: string[];
  excludeAccountId?: string;
}) {
  const uniqueAliases = new Set(aliases);

  if (uniqueAliases.size !== aliases.length) {
    throw new Error("Duplicate aliases are not allowed.");
  }

  const accounts = await prisma.account.findMany({
    where: {
      userId,
      ...(excludeAccountId
        ? {
            id: {
              not: excludeAccountId,
            },
          }
        : {}),
    },
    select: {
      aliases: true,
    },
  });
  const existingAliases = new Set(
    accounts.flatMap((account) => account.aliases.map(normaliseAccountAlias)),
  );
  const conflict = aliases.find((alias) => existingAliases.has(alias));

  if (conflict) {
    throw new Error(`Alias already exists: ${conflict}`);
  }
}

export async function setDefaultAccount({
  userId,
  accountId,
}: {
  userId: string;
  accountId: string;
}) {
  const target = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!target) {
    throw new Error("Account not found.");
  }

  await prisma.$transaction([
    prisma.account.updateMany({
      where: {
        userId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    }),
    prisma.account.updateMany({
      where: {
        id: accountId,
        userId,
      },
      data: {
        isDefault: true,
        isActive: true,
      },
    }),
  ]);
}

export function findAccountAliasInText({
  text,
  accounts,
}: {
  text: string;
  accounts: AccountForSelection[];
}) {
  const normalisedText = normaliseAccountAlias(text);
  const matches = accounts.flatMap((account) =>
    account.aliases
      .map((alias) => normaliseAccountAlias(alias))
      .filter(Boolean)
      .filter((alias) => {
        const paddedText = ` ${normalisedText} `;
        const paddedAlias = ` ${alias} `;

        return (
          paddedText.includes(paddedAlias) ||
          (alias.includes(" ") &&
            normalisedText.replace(/\s+/g, "").includes(alias.replace(/\s+/g, "")))
        );
      })
      .map((alias) => ({
        account,
        alias,
      })),
  );

  return matches.toSorted((a, b) => b.alias.length - a.alias.length)[0] ?? null;
}

export function findAccountAliasMatchesInText({
  text,
  accounts,
}: {
  text: string;
  accounts: AccountForSelection[];
}) {
  const normalisedText = normaliseAccountAlias(text);
  const matches = accounts.flatMap((account) =>
    account.aliases
      .map((alias) => normaliseAccountAlias(alias))
      .filter(Boolean)
      .map((alias) => {
        const pattern = new RegExp(
          `(^|\\s)${alias
            .split(" ")
            .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("[\\s\\W_]+")}(?=\\s|$)`,
          "i",
        );
        const match = normalisedText.match(pattern);

        if (!match || match.index === undefined) {
          return null;
        }

        return {
          account,
          alias,
          index: match.index + (match[1]?.length ?? 0),
        };
      })
      .filter((match) => match !== null),
  );

  return matches.toSorted((a, b) => {
    const indexDiff = a.index - b.index;

    if (indexDiff !== 0) {
      return indexDiff;
    }

    return b.alias.length - a.alias.length;
  });
}

export function removeAccountAliasFromText({
  text,
  alias,
}: {
  text: string;
  alias: string;
}) {
  const words = alias.split(" ").filter(Boolean);
  const escapedWords = words.map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(
    `(^|\\s)${escapedWords.join("[\\s\\W_]+")}(?=\\s|$)`,
    "i",
  );

  return text.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

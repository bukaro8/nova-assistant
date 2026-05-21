"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AccountType } from "@/generated/prisma/enums";
import {
  assertAliasesAreUniqueForUser,
  ensureDefaultAccount,
  setDefaultAccount,
} from "@/server/accounts/accounts";
import { parseAccountAliases } from "@/lib/account-aliases";
import { createAccountTransfer } from "@/server/accounts/transfers";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";

function accountsRedirectMessage(type: "success" | "error", message: string): never {
  const params = new URLSearchParams({ type, message });
  redirect(`/accounts?${params.toString()}`);
}

function parseDueDay(value: string, type: AccountType) {
  const trimmed = value.trim();

  if (type !== AccountType.CREDIT_CARD || !trimmed) {
    return null;
  }

  const dueDay = Number(trimmed);

  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    return undefined;
  }

  return dueDay;
}

function parseAccountForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const rawType = String(formData.get("type") ?? "").trim();
  const rawOpeningBalance = String(formData.get("openingBalance") ?? "0").trim();
  const rawAliases = String(formData.get("aliases") ?? "");
  const rawDueDay = String(formData.get("dueDay") ?? "");
  const openingBalance = Number(rawOpeningBalance || "0");

  if (
    !name ||
    name.length > 80 ||
    !Object.values(AccountType).includes(rawType as AccountType) ||
    Number.isNaN(openingBalance)
  ) {
    return null;
  }

  const type = rawType as AccountType;
  const dueDay = parseDueDay(rawDueDay, type);

  if (dueDay === undefined) {
    return null;
  }

  return {
    name,
    type,
    aliases: parseAccountAliases(rawAliases, name),
    openingBalance: rawOpeningBalance || "0",
    dueDay,
  };
}

function revalidateAccountPaths() {
  revalidatePath("/settings");
  revalidatePath("/accounts");
  revalidatePath("/settings/accounts");
  revalidatePath("/expenses");
  revalidatePath("/today");
}

export async function createAccount(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = parseAccountForm(formData);

  if (!parsed) {
    accountsRedirectMessage("error", "Invalid account");
  }

  try {
    await assertAliasesAreUniqueForUser({
      userId: user.id,
      aliases: parsed.aliases,
    });
  } catch {
    accountsRedirectMessage("error", "Account aliases must be unique");
  }

  const existingDefault = await ensureDefaultAccount(user.id);

  await prisma.account.create({
    data: {
      userId: user.id,
      ...parsed,
      isDefault: false,
      isActive: true,
    },
  });

  if (!existingDefault.isDefault) {
    await ensureDefaultAccount(user.id);
  }

  revalidateAccountPaths();
  accountsRedirectMessage("success", "Account created");
}

export async function updateAccount(accountId: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = parseAccountForm(formData);

  if (!parsed) {
    accountsRedirectMessage("error", "Invalid account");
  }

  try {
    await assertAliasesAreUniqueForUser({
      userId: user.id,
      aliases: parsed.aliases,
      excludeAccountId: accountId,
    });
  } catch {
    accountsRedirectMessage("error", "Account aliases must be unique");
  }

  await prisma.account.updateMany({
    where: {
      id: accountId,
      userId: user.id,
    },
    data: parsed,
  });

  revalidateAccountPaths();
  accountsRedirectMessage("success", "Account updated");
}

export async function disableAccount(accountId: string) {
  const user = await requireCurrentUser();
  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId: user.id,
    },
  });

  if (!account) {
    accountsRedirectMessage("error", "Account not found");
  }

  if (account.isDefault) {
    const replacement = await prisma.account.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        id: {
          not: account.id,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!replacement) {
      accountsRedirectMessage("error", "A default account is required");
    }
  }

  await prisma.account.updateMany({
    where: {
      id: account.id,
      userId: user.id,
    },
    data: {
      isActive: false,
      isDefault: false,
    },
  });

  if (account.isDefault) {
    await ensureDefaultAccount(user.id);
  }

  revalidateAccountPaths();
  accountsRedirectMessage("success", "Account disabled");
}

export async function deleteAccount(accountId: string) {
  const user = await requireCurrentUser();
  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId: user.id,
    },
    include: {
      _count: {
        select: {
          expenses: true,
        },
      },
    },
  });

  if (!account) {
    accountsRedirectMessage("error", "Account not found");
  }

  if (account._count.expenses > 0) {
    accountsRedirectMessage("error", "Delete blocked because expenses exist");
  }

  await prisma.account.delete({
    where: {
      id: account.id,
    },
  });

  if (account.isDefault) {
    await ensureDefaultAccount(user.id);
  }

  revalidateAccountPaths();
  accountsRedirectMessage("success", "Account deleted");
}

export async function setDefaultAccountAction(accountId: string) {
  const user = await requireCurrentUser();

  try {
    await setDefaultAccount({
      userId: user.id,
      accountId,
    });
  } catch {
    accountsRedirectMessage("error", "Account not found");
  }

  revalidateAccountPaths();
  accountsRedirectMessage("success", "Default account updated");
}

export async function createTransfer(formData: FormData) {
  const user = await requireCurrentUser();
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const fromAccountId = String(formData.get("fromAccountId") ?? "").trim();
  const toAccountId = String(formData.get("toAccountId") ?? "").trim();
  const amount = Number(rawAmount);

  if (
    !rawAmount ||
    Number.isNaN(amount) ||
    amount <= 0 ||
    !fromAccountId ||
    !toAccountId
  ) {
    accountsRedirectMessage("error", "Invalid transfer");
  }

  if (fromAccountId === toAccountId) {
    accountsRedirectMessage(
      "error",
      "Source and destination accounts must be different",
    );
  }

  const accounts = await prisma.account.findMany({
    where: {
      userId: user.id,
      id: {
        in: [fromAccountId, toAccountId],
      },
      isActive: true,
    },
  });
  const fromAccount = accounts.find((account) => account.id === fromAccountId);
  const toAccount = accounts.find((account) => account.id === toAccountId);

  if (!fromAccount || !toAccount) {
    accountsRedirectMessage("error", "Transfer account not found");
  }

  await createAccountTransfer({
    userId: user.id,
    amount,
    fromAccount,
    toAccount,
    rawText: `Transfer ${fromAccount.name} to ${toAccount.name}`,
    source: "dashboard",
    createdVia: "dashboard",
  });

  revalidateAccountPaths();
  revalidatePath("/dashboard");
  revalidatePath("/reports/weekly");
  accountsRedirectMessage("success", "Transfer saved");
}

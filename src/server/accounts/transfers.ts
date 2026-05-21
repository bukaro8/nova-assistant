import { ExpenseCategory } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/prisma";

export type TransferAccount = {
  id: string;
  name: string;
};

export async function createAccountTransfer({
  userId,
  amount,
  fromAccount,
  toAccount,
  rawText,
  source,
  createdVia,
  expenseDate = new Date(),
}: {
  userId: string;
  amount: number | string;
  fromAccount: TransferAccount;
  toAccount: TransferAccount;
  rawText: string;
  source: string;
  createdVia: string;
  expenseDate?: Date;
}) {
  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error("Transfer amount must be positive.");
  }

  if (fromAccount.id === toAccount.id) {
    throw new Error("Transfer accounts must be different.");
  }

  const amountText = numericAmount.toFixed(2);

  return prisma.$transaction([
    prisma.expense.create({
      data: {
        userId,
        accountId: fromAccount.id,
        amount: amountText,
        description: `Transfer to ${toAccount.name}`,
        rawText,
        category: ExpenseCategory.TRANSFER,
        confidence: 1,
        source,
        createdVia,
        expenseDate,
      },
    }),
    prisma.expense.create({
      data: {
        userId,
        accountId: toAccount.id,
        amount: `-${amountText}`,
        description: `Transfer from ${fromAccount.name}`,
        rawText,
        category: ExpenseCategory.TRANSFER,
        confidence: 1,
        source,
        createdVia,
        expenseDate,
      },
    }),
  ]);
}

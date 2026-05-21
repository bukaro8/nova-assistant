"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ExpenseCategory } from "@/generated/prisma/enums";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";
import { getInitialMonthlyRunAt } from "@/server/expenses/recurring-payments";

function recurringPaymentsRedirectMessage(
  type: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ type, message });
  redirect(`/expenses/recurring?${params.toString()}`);
}

function parseRecurringPaymentForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const rawDayOfMonth = String(formData.get("dayOfMonth") ?? "").trim();
  const amount = Number(rawAmount);
  const dayOfMonth = Number(rawDayOfMonth);
  const isActive = formData.get("isActive") === "on";

  if (
    !name ||
    name.length > 80 ||
    !rawAmount ||
    Number.isNaN(amount) ||
    amount <= 0 ||
    !Number.isInteger(dayOfMonth) ||
    dayOfMonth < 1 ||
    dayOfMonth > 31 ||
    !Object.values(ExpenseCategory).includes(category as ExpenseCategory) ||
    category === ExpenseCategory.INCOME ||
    category === ExpenseCategory.TRANSFER
  ) {
    return null;
  }

  return {
    name,
    amount: rawAmount,
    category: category as ExpenseCategory,
    dayOfMonth,
    isActive,
  };
}

export async function createRecurringPayment(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = parseRecurringPaymentForm(formData);

  if (!parsed) {
    recurringPaymentsRedirectMessage("error", "Invalid recurring payment");
  }

  await prisma.recurringPayment.create({
    data: {
      userId: user.id,
      ...parsed,
      frequency: "MONTHLY",
      nextRunAt: getInitialMonthlyRunAt(parsed.dayOfMonth),
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/expenses/recurring");
  recurringPaymentsRedirectMessage("success", "Recurring payment created");
}

export async function updateRecurringPayment(
  recurringPaymentId: string,
  formData: FormData,
) {
  const user = await requireCurrentUser();
  const parsed = parseRecurringPaymentForm(formData);

  if (!parsed) {
    recurringPaymentsRedirectMessage("error", "Invalid recurring payment");
  }

  await prisma.recurringPayment.updateMany({
    where: {
      id: recurringPaymentId,
      userId: user.id,
    },
    data: {
      ...parsed,
      nextRunAt: getInitialMonthlyRunAt(parsed.dayOfMonth),
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/expenses/recurring");
  recurringPaymentsRedirectMessage("success", "Recurring payment updated");
}

export async function disableRecurringPayment(recurringPaymentId: string) {
  const user = await requireCurrentUser();

  await prisma.recurringPayment.updateMany({
    where: {
      id: recurringPaymentId,
      userId: user.id,
    },
    data: {
      isActive: false,
    },
  });

  revalidatePath("/expenses/recurring");
  recurringPaymentsRedirectMessage("success", "Recurring payment disabled");
}

export async function deleteRecurringPayment(recurringPaymentId: string) {
  const user = await requireCurrentUser();

  await prisma.recurringPayment.deleteMany({
    where: {
      id: recurringPaymentId,
      userId: user.id,
    },
  });

  revalidatePath("/expenses/recurring");
  recurringPaymentsRedirectMessage("success", "Recurring payment deleted");
}

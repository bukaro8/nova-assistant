import { ExpenseCategory } from "@/generated/prisma/enums";
import { parseTelegramExpenseMessage } from "./parse-telegram-expense";

const examples = [
  {
    text: "10 milk",
    amount: "10",
    description: "milk",
    category: ExpenseCategory.GROCERIES,
  },
  {
    text: "milk 10",
    amount: "10",
    description: "milk",
    category: ExpenseCategory.GROCERIES,
  },
  {
    text: "15.48 aldi",
    amount: "15.48",
    description: "aldi",
    category: ExpenseCategory.GROCERIES,
  },
  {
    text: "aldi 15.48",
    amount: "15.48",
    description: "aldi",
    category: ExpenseCategory.GROCERIES,
  },
  {
    text: "coffee 5",
    amount: "5",
    description: "coffee",
    category: ExpenseCategory.FOOD,
  },
  {
    text: "5 coffee",
    amount: "5",
    description: "coffee",
    category: ExpenseCategory.FOOD,
  },
  {
    text: "10.48 milk 01/05/2026",
    amount: "10.48",
    description: "milk",
    category: ExpenseCategory.GROCERIES,
    date: "01/05/2026",
  },
  {
    text: "milk 10.48 01/05/2026",
    amount: "10.48",
    description: "milk",
    category: ExpenseCategory.GROCERIES,
    date: "01/05/2026",
  },
  {
    text: "-100 salary",
    amount: "-100",
    description: "salary",
    category: ExpenseCategory.INCOME,
  },
  {
    text: "salary -100",
    amount: "-100",
    description: "salary",
    category: ExpenseCategory.INCOME,
  },
  {
    text: "milk 10 and bread 2",
    amount: "10",
    description: "milk and bread 2",
    category: ExpenseCategory.GROCERIES,
  },
];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

for (const example of examples) {
  const result = parseTelegramExpenseMessage({ text: example.text });

  if (!result.ok) {
    throw new Error(`${example.text}: expected parse success`);
  }

  const { expense } = result;

  if (
    expense.amount !== example.amount ||
    expense.description !== example.description ||
    expense.category !== example.category ||
    (example.date && formatDate(expense.expenseDate) !== example.date)
  ) {
    throw new Error(
      `${example.text}: got ${JSON.stringify({
        amount: expense.amount,
        description: expense.description,
        category: expense.category,
        date: formatDate(expense.expenseDate),
      })}`,
    );
  }
}

const amountOnly = parseTelegramExpenseMessage({ text: "10" });

if (amountOnly.ok || amountOnly.reason !== "missing-description") {
  throw new Error("10: expected missing-description failure");
}

const noAmount = parseTelegramExpenseMessage({ text: "milk" });

if (noAmount.ok || noAmount.reason !== "missing-amount") {
  throw new Error("milk: expected missing-amount failure");
}

console.log(`Parsed ${examples.length} Telegram expense examples.`);

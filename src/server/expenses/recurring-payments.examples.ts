import {
  getNextMonthlyRunAt,
  getRecurringPaymentMonthKey,
  processDueRecurringPayments,
} from "./recurring-payments";

type FakePayment = {
  id: string;
  userId: string;
  name: string;
  amount: string;
  category: string;
  dayOfMonth: number;
  nextRunAt: Date;
  isActive: boolean;
};

type FakeExpense = {
  recurringPaymentId: string;
  recurringForMonth: string;
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function createFakeDb({
  payments,
  expenses = [],
}: {
  payments: FakePayment[];
  expenses?: FakeExpense[];
}) {
  return {
    recurringPayment: {
      async findMany(args: unknown) {
        const now = (args as { where: { nextRunAt: { lte: Date } } }).where
          .nextRunAt.lte;

        return payments
          .filter(
            (payment) =>
              payment.isActive && payment.nextRunAt.getTime() <= now.getTime(),
          )
          .sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime());
      },
      async update(args: unknown) {
        const updateArgs = args as {
          where: { id: string };
          data: { nextRunAt: Date };
        };
        const payment = payments.find(
          (item) => item.id === updateArgs.where.id,
        );

        if (payment) {
          payment.nextRunAt = updateArgs.data.nextRunAt;
        }
      },
    },
    expense: {
      async create(args: unknown) {
        const data = (args as {
          data: {
            recurringPaymentId: string;
            recurringForMonth: string;
          };
        }).data;
        const duplicate = expenses.some(
          (expense) =>
            expense.recurringPaymentId === data.recurringPaymentId &&
            expense.recurringForMonth === data.recurringForMonth,
        );

        if (duplicate) {
          throw { code: "P2002" };
        }

        expenses.push({
          recurringPaymentId: data.recurringPaymentId,
          recurringForMonth: data.recurringForMonth,
        });
      },
    },
    expenses,
  };
}

async function runExamples() {
  const mayRunAt = new Date("2026-05-01T11:00:00.000Z");
  const now = new Date("2026-05-16T12:00:00.000Z");
  const payment: FakePayment = {
    id: "recurring-rent",
    userId: "user-1",
    name: "Rent",
    amount: "900.00",
    category: "HOUSING_BILLS",
    dayOfMonth: 1,
    nextRunAt: mayRunAt,
    isActive: true,
  };
  const db = createFakeDb({
    payments: [payment],
  });

  const result = await processDueRecurringPayments({
    now,
    db,
  });

  assert(result.processed === 1, "Expected one due payment to be processed.");
  assert(result.generated === 1, "Expected one expense to be generated.");
  assert(db.expenses.length === 1, "Expected one expense in fake database.");
  assert(
    db.expenses[0]?.recurringForMonth === "2026-05",
    "Expected recurring month key for May 2026.",
  );
  assert(
    getRecurringPaymentMonthKey(payment.nextRunAt) === "2026-06",
    "Expected next run to advance to June 2026.",
  );

  const duplicatePayment: FakePayment = {
    ...payment,
    nextRunAt: mayRunAt,
  };
  const duplicateDb = createFakeDb({
    payments: [duplicatePayment],
    expenses: [
      {
        recurringPaymentId: duplicatePayment.id,
        recurringForMonth: "2026-05",
      },
    ],
  });
  const duplicateResult = await processDueRecurringPayments({
    now,
    db: duplicateDb,
  });

  assert(
    duplicateResult.generated === 0,
    "Expected duplicate run not to create another expense.",
  );
  assert(
    duplicateResult.skipped === 1,
    "Expected duplicate run to be counted as skipped.",
  );
  assert(
    duplicateDb.expenses.length === 1,
    "Expected duplicate protection to keep one expense.",
  );

  const advanced = getNextMonthlyRunAt(31, new Date("2026-01-31T12:00:00Z"));

  assert(
    getRecurringPaymentMonthKey(advanced) === "2026-02",
    "Expected day 31 schedules to advance to February safely.",
  );

  const inactiveDb = createFakeDb({
    payments: [
      {
        ...payment,
        id: "inactive-payment",
        isActive: false,
        nextRunAt: mayRunAt,
      },
    ],
  });
  const inactiveResult = await processDueRecurringPayments({
    now,
    db: inactiveDb,
  });

  assert(
    inactiveResult.processed === 0 && inactiveDb.expenses.length === 0,
    "Expected inactive payments to be skipped by the due query.",
  );

  console.log("Recurring payment examples passed.");
}

runExamples().catch((error) => {
  console.error(error);
  process.exit(1);
});

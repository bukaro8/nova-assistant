ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'INSURANCE';

CREATE TYPE "RecurringPaymentFrequency" AS ENUM ('MONTHLY');

CREATE TABLE "RecurringPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "frequency" "RecurringPaymentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "dayOfMonth" INTEGER NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringPayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense"
ADD COLUMN "recurringPaymentId" TEXT,
ADD COLUMN "recurringForMonth" TEXT;

CREATE INDEX "RecurringPayment_userId_idx" ON "RecurringPayment"("userId");
CREATE INDEX "RecurringPayment_isActive_nextRunAt_idx" ON "RecurringPayment"("isActive", "nextRunAt");
CREATE INDEX "Expense_recurringPaymentId_idx" ON "Expense"("recurringPaymentId");
CREATE UNIQUE INDEX "Expense_recurringPaymentId_recurringForMonth_key" ON "Expense"("recurringPaymentId", "recurringForMonth");

ALTER TABLE "RecurringPayment"
ADD CONSTRAINT "RecurringPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_recurringPaymentId_fkey" FOREIGN KEY ("recurringPaymentId") REFERENCES "RecurringPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

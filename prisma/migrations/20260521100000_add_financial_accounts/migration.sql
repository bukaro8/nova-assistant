CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK', 'CREDIT_CARD');

CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "aliases" TEXT[] NOT NULL,
    "openingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dueDay" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense"
ADD COLUMN "accountId" TEXT;

CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Account_userId_isDefault_idx" ON "Account"("userId", "isDefault");
CREATE INDEX "Account_userId_isActive_idx" ON "Account"("userId", "isActive");
CREATE UNIQUE INDEX "Account_one_default_per_user_idx" ON "Account"("userId") WHERE "isDefault" = true;
CREATE INDEX "Expense_accountId_idx" ON "Expense"("accountId");

ALTER TABLE "Account"
ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

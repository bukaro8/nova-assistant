-- CreateEnum
CREATE TYPE "HabitStatus" AS ENUM ('DONE', 'SKIPPED', 'MISSED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('GROCERIES', 'FOOD', 'TRANSPORT', 'BILLS', 'SANDS', 'INCOME', 'SHOPPING', 'OTHER');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "createdVia" TEXT NOT NULL DEFAULT 'telegram',
ADD COLUMN     "rawText" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL,
DROP COLUMN "category",
ADD COLUMN     "category" "ExpenseCategory";

-- AlterTable
ALTER TABLE "Habit" DROP COLUMN "retryTime",
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "reminderMessage" TEXT NOT NULL,
ADD COLUMN     "retryTimes" TEXT[],
ADD COLUMN     "scheduleDays" TEXT[],
ADD COLUMN     "userId" TEXT NOT NULL,
ADD COLUMN     "validReplies" TEXT[];

-- AlterTable
ALTER TABLE "HabitLog" ADD COLUMN     "loggedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "replyText" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "HabitStatus" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramExpenseChatId" TEXT,
ADD COLUMN     "telegramHabitChatId" TEXT;

-- AlterTable
ALTER TABLE "WeightLog" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'dashboard',
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Expense_userId_expenseDate_idx" ON "Expense"("userId", "expenseDate");

-- CreateIndex
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Habit_userId_code_key" ON "Habit"("userId", "code");

-- CreateIndex
CREATE INDEX "HabitLog_userId_loggedAt_idx" ON "HabitLog"("userId", "loggedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramHabitChatId_key" ON "User"("telegramHabitChatId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramExpenseChatId_key" ON "User"("telegramExpenseChatId");

-- CreateIndex
CREATE INDEX "WeightLog_userId_createdAt_idx" ON "WeightLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightLog" ADD CONSTRAINT "WeightLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

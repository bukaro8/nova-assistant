CREATE TABLE "ExpenseCategoryRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "keyword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategoryRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseCategoryRule_userId_category_keyword_key" ON "ExpenseCategoryRule"("userId", "category", "keyword");

CREATE INDEX "ExpenseCategoryRule_userId_idx" ON "ExpenseCategoryRule"("userId");

ALTER TABLE "ExpenseCategoryRule" ADD CONSTRAINT "ExpenseCategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

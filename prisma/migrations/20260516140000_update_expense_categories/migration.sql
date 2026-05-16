CREATE TYPE "ExpenseCategory_new" AS ENUM (
    'GROCERIES',
    'TAKEAWAY',
    'COFFEE_SNACKS',
    'TRANSPORT',
    'PERSONAL_CARE',
    'ENTERTAINMENT',
    'SUBSCRIPTIONS',
    'SHOPPING',
    'HOUSEHOLD',
    'HOUSING_BILLS',
    'PETS',
    'HEALTH',
    'WORK',
    'INCOME',
    'OTHER'
);

ALTER TABLE "Expense"
ALTER COLUMN "category" TYPE "ExpenseCategory_new"
USING (
    CASE "category"::text
        WHEN 'FOOD' THEN 'TAKEAWAY'
        WHEN 'BILLS' THEN 'HOUSING_BILLS'
        WHEN 'SANDS' THEN 'WORK'
        ELSE "category"::text
    END
)::"ExpenseCategory_new";

ALTER TABLE "ExpenseCategoryRule"
ALTER COLUMN "category" TYPE "ExpenseCategory_new"
USING (
    CASE "category"::text
        WHEN 'FOOD' THEN 'TAKEAWAY'
        WHEN 'BILLS' THEN 'HOUSING_BILLS'
        WHEN 'SANDS' THEN 'WORK'
        ELSE "category"::text
    END
)::"ExpenseCategory_new";

DROP TYPE "ExpenseCategory";
ALTER TYPE "ExpenseCategory_new" RENAME TO "ExpenseCategory";

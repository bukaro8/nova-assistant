export const ExpenseCategory = {
  GROCERIES: "GROCERIES",
  TAKEAWAY: "TAKEAWAY",
  COFFEE_SNACKS: "COFFEE_SNACKS",
  TRANSPORT: "TRANSPORT",
  PERSONAL_CARE: "PERSONAL_CARE",
  ENTERTAINMENT: "ENTERTAINMENT",
  SUBSCRIPTIONS: "SUBSCRIPTIONS",
  INSURANCE: "INSURANCE",
  SHOPPING: "SHOPPING",
  HOUSEHOLD: "HOUSEHOLD",
  HOUSING_BILLS: "HOUSING_BILLS",
  PETS: "PETS",
  HEALTH: "HEALTH",
  WORK: "WORK",
  INCOME: "INCOME",
  OTHER: "OTHER",
} as const;

export type ExpenseCategoryValue =
  (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export type ExpenseCategoryRuleInput = {
  category: ExpenseCategoryValue;
  keyword: string;
};

export type ExpenseCategorisation = {
  category: ExpenseCategoryValue;
  matchedKeyword: string | null;
  confidence: number;
  source: "user" | "income-keyword" | "merchant" | "built-in" | "amount" | "fallback";
};

const CATEGORY_ORDER: ExpenseCategoryValue[] = [
  ExpenseCategory.GROCERIES,
  ExpenseCategory.TAKEAWAY,
  ExpenseCategory.COFFEE_SNACKS,
  ExpenseCategory.TRANSPORT,
  ExpenseCategory.PERSONAL_CARE,
  ExpenseCategory.ENTERTAINMENT,
  ExpenseCategory.SUBSCRIPTIONS,
  ExpenseCategory.INSURANCE,
  ExpenseCategory.SHOPPING,
  ExpenseCategory.HOUSEHOLD,
  ExpenseCategory.HOUSING_BILLS,
  ExpenseCategory.PETS,
  ExpenseCategory.HEALTH,
  ExpenseCategory.WORK,
  ExpenseCategory.INCOME,
  ExpenseCategory.OTHER,
];

export const builtInExpenseCategoryKeywords: Record<
  ExpenseCategoryValue,
  string[]
> = {
  GROCERIES: [
    "aldi",
    "asda",
    "bread",
    "chicken",
    "co-op",
    "coop",
    "co op",
    "eggs",
    "fruit",
    "iceland",
    "lidl",
    "meat",
    "milk",
    "morrisons",
    "pasta",
    "rice",
    "sainsburys",
    "sainsbury's",
    "sainsbury",
    "tesco",
    "vegetables",
    "waitrose",
  ],
  TAKEAWAY: [
    "burger king",
    "chinese",
    "deliveroo",
    "just eat",
    "justeat",
    "kebab",
    "kfc",
    "mcdonalds",
    "mcdonald's",
    "nandos",
    "nando's",
    "pizza",
    "takeaway",
    "take away",
    "uber eats",
    "ubereats",
  ],
  COFFEE_SNACKS: [
    "americano",
    "caffe nero",
    "cappuccino",
    "coffee",
    "costa",
    "crisps",
    "greggs",
    "latte",
    "nero",
    "pastry",
    "pret",
    "snack",
    "starbucks",
  ],
  TRANSPORT: [
    "bolt",
    "bp",
    "bus",
    "car wash",
    "car park",
    "congestion",
    "congestion charge",
    "diesel",
    "esso",
    "fuel",
    "ncp",
    "oyster",
    "parking",
    "paybyphone",
    "petrol",
    "ringgo",
    "shell",
    "tfl",
    "taxi",
    "toll",
    "train",
    "tube",
    "uber",
    "underground",
  ],
  PERSONAL_CARE: [
    "barber",
    "beard",
    "fade",
    "grooming",
    "hair cut",
    "haircut",
    "nails",
    "salon",
    "trim",
  ],
  ENTERTAINMENT: [
    "airbnb",
    "bar",
    "beer",
    "bowling",
    "cinema",
    "concert",
    "drinks",
    "festival",
    "games",
    "holiday",
    "hotel",
    "movie",
    "museum",
    "night out",
    "playstation",
    "pub",
    "steam",
    "tickets",
    "trip",
    "xbox",
  ],
  SUBSCRIPTIONS: [
    "amazon prime",
    "apple",
    "chatgpt",
    "disney",
    "github",
    "google",
    "icloud",
    "netflix",
    "openai",
    "spotify",
    "youtube premium",
  ],
  INSURANCE: [
    "car insurance",
    "contents insurance",
    "home insurance",
    "insurance",
    "life insurance",
    "motor insurance",
  ],
  SHOPPING: [
    "amazon",
    "argos",
    "clothes",
    "ebay",
    "electronics",
    "jacket",
    "shoes",
    "temu",
    "tools",
  ],
  HOUSEHOLD: [
    "bin bags",
    "bleach",
    "cleaning",
    "detergent",
    "dishwasher",
    "kitchen roll",
    "toilet paper",
    "washing powder",
  ],
  HOUSING_BILLS: [
    "broadband",
    "british gas",
    "council tax",
    "ee broadband",
    "electricity",
    "energy",
    "gas",
    "internet",
    "octopus",
    "plusnet",
    "rent",
    "thames water",
    "virgin media",
    "water",
  ],
  PETS: [
    "argos pet",
    "dog food",
    "grooming",
    "pet",
    "pet insurance",
    "pet shop",
    "pets",
    "puppy",
    "toys",
    "vet",
  ],
  HEALTH: [
    "boots pharmacy",
    "dentist",
    "doctor",
    "medication",
    "optician",
    "pharmacy",
    "prescription",
  ],
  WORK: [
    "materials",
    "parking for work",
    "ppe",
    "tools",
    "uniform",
    "work",
    "work tools",
  ],
  INCOME: [
    "benefit",
    "bonus",
    "cashback",
    "child benefit",
    "dividend",
    "hmrc",
    "income",
    "interest",
    "pay",
    "payment received",
    "pension",
    "refund",
    "salary",
    "tax refund",
    "uc",
    "universal credit",
    "wages",
  ],
  OTHER: [],
};

export function normaliseExpenseText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normaliseExpenseKeyword(value: string) {
  return normaliseExpenseText(value);
}

function compact(value: string) {
  return value.replace(/\s+/g, "");
}

function keywordWordCount(keyword: string) {
  return keyword.split(" ").filter(Boolean).length;
}

function sortedRules(rules: ExpenseCategoryRuleInput[]) {
  return rules
    .map((rule) => ({
      ...rule,
      keyword: normaliseExpenseKeyword(rule.keyword),
    }))
    .filter((rule) => rule.keyword.length > 0)
    .sort((a, b) => {
      const wordDiff = keywordWordCount(b.keyword) - keywordWordCount(a.keyword);

      if (wordDiff !== 0) {
        return wordDiff;
      }

      return b.keyword.length - a.keyword.length;
    });
}

function textMatchesKeyword(text: string, keyword: string) {
  const paddedText = ` ${text} `;
  const paddedKeyword = ` ${keyword} `;

  if (paddedText.includes(paddedKeyword)) {
    return true;
  }

  return keywordWordCount(keyword) > 1 && compact(text).includes(compact(keyword));
}

function matchRules({
  text,
  rules,
  source,
}: {
  text: string;
  rules: ExpenseCategoryRuleInput[];
  source: "user" | "income-keyword" | "merchant" | "built-in";
}): ExpenseCategorisation | null {
  const match = sortedRules(rules).find((rule) =>
    textMatchesKeyword(text, rule.keyword),
  );

  if (!match) {
    return null;
  }

  const phraseMatch = keywordWordCount(match.keyword) > 1;

  return {
    category: match.category,
    matchedKeyword: match.keyword,
    confidence:
      source === "user"
        ? phraseMatch
          ? 0.98
          : 0.94
        : source === "income-keyword"
          ? phraseMatch
            ? 0.98
            : 0.95
          : source === "merchant"
            ? 0.92
            : phraseMatch
              ? 0.9
              : 0.84,
    source,
  };
}

function builtInRules() {
  return CATEGORY_ORDER.flatMap((category) =>
    builtInExpenseCategoryKeywords[category].map((keyword) => ({
      category,
      keyword,
    })),
  );
}

function incomeKeywordRules() {
  return builtInExpenseCategoryKeywords.INCOME.map((keyword) => ({
    category: ExpenseCategory.INCOME,
    keyword,
  }));
}

function merchantExactRules() {
  const merchantCategories: ExpenseCategoryValue[] = [
    ExpenseCategory.GROCERIES,
    ExpenseCategory.TAKEAWAY,
    ExpenseCategory.COFFEE_SNACKS,
    ExpenseCategory.TRANSPORT,
    ExpenseCategory.SUBSCRIPTIONS,
    ExpenseCategory.INSURANCE,
    ExpenseCategory.SHOPPING,
    ExpenseCategory.HOUSING_BILLS,
    ExpenseCategory.HEALTH,
  ];

  return merchantCategories.flatMap((category) =>
    builtInExpenseCategoryKeywords[category].map((keyword) => ({
      category,
      keyword,
    })),
  );
}

function matchExactMerchant(text: string): ExpenseCategorisation | null {
  const match = sortedRules(merchantExactRules()).find(
    (rule) => text === rule.keyword || compact(text) === compact(rule.keyword),
  );

  if (!match) {
    return null;
  }

  return {
    category: match.category,
    matchedKeyword: match.keyword,
    confidence: 0.92,
    source: "merchant",
  };
}

export function categoriseExpense({
  text,
  amount,
  userOverrideRules = [],
  userRules = [],
}: {
  text: string;
  amount?: number | string | null;
  userOverrideRules?: ExpenseCategoryRuleInput[];
  userRules?: ExpenseCategoryRuleInput[];
}): ExpenseCategorisation {
  const normalisedText = normaliseExpenseText(text);
  const numericAmount =
    typeof amount === "number"
      ? amount
      : amount === null || amount === undefined || amount === ""
        ? null
        : Number(amount);

  if (numericAmount !== null && !Number.isNaN(numericAmount) && numericAmount < 0) {
    return {
      category: ExpenseCategory.INCOME,
      matchedKeyword: "negative amount",
      confidence: 0.98,
      source: "amount",
    };
  }

  const userOverrideMatch = matchRules({
    text: normalisedText,
    rules: userOverrideRules,
    source: "user",
  });

  if (userOverrideMatch) {
    return userOverrideMatch;
  }

  const incomeKeywordMatch = matchRules({
    text: normalisedText,
    rules: incomeKeywordRules(),
    source: "income-keyword",
  });

  if (incomeKeywordMatch) {
    return incomeKeywordMatch;
  }

  const userMatch = matchRules({
    text: normalisedText,
    rules: userRules,
    source: "user",
  });

  if (userMatch) {
    return userMatch;
  }

  const merchantExactMatch = matchExactMerchant(normalisedText);

  if (merchantExactMatch) {
    return merchantExactMatch;
  }

  const builtInMatch = matchRules({
    text: normalisedText,
    rules: builtInRules(),
    source: "built-in",
  });

  if (builtInMatch) {
    return builtInMatch;
  }

  return {
    category: ExpenseCategory.OTHER,
    matchedKeyword: null,
    confidence: 0.15,
    source: "fallback",
  };
}

export async function categoriseExpenseForUser({
  userId,
  text,
  amount,
}: {
  userId: string;
  text: string;
  amount?: number | string | null;
}) {
  const { prisma } = await import("@/server/db/prisma");
  const rules = await prisma.expenseCategoryRule.findMany({
    where: {
      userId,
    },
    select: {
      category: true,
      keyword: true,
    },
  });

  return categoriseExpense({
    text,
    amount,
    userRules: rules,
  });
}

export function getExpenseCategoryLabel(category: string | null | undefined) {
  if (!category) {
    return "Uncategorised";
  }

  return category
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

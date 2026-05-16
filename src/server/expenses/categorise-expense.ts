import { ExpenseCategory } from "../../generated/prisma/enums";

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
  source: "user" | "built-in" | "amount" | "fallback";
};

const CATEGORY_ORDER: ExpenseCategoryValue[] = [
  ExpenseCategory.GROCERIES,
  ExpenseCategory.FOOD,
  ExpenseCategory.TRANSPORT,
  ExpenseCategory.BILLS,
  ExpenseCategory.SANDS,
  ExpenseCategory.INCOME,
  ExpenseCategory.SHOPPING,
  ExpenseCategory.OTHER,
];

export const builtInExpenseCategoryKeywords: Record<
  ExpenseCategoryValue,
  string[]
> = {
  GROCERIES: [
    "aldi",
    "asda",
    "bakery",
    "banana",
    "beef",
    "beer",
    "berries",
    "biscuit",
    "bread",
    "broccoli",
    "butcher",
    "butter",
    "carrots",
    "cereal",
    "cheese",
    "chicken",
    "chocolate",
    "coffee beans",
    "co-op",
    "coop",
    "co op",
    "corner shop",
    "crisps",
    "deli",
    "dairy",
    "dessert",
    "dishwasher tablets",
    "eggs",
    "farmfoods",
    "fish",
    "flour",
    "food shop",
    "frozen food",
    "fruit",
    "garlic",
    "grapes",
    "greengrocer",
    "grocery",
    "groceries",
    "ham",
    "herbs",
    "iceland",
    "jam",
    "juice",
    "lamb",
    "lettuce",
    "lidl",
    "loo roll",
    "market",
    "marks and spencer food",
    "m and s food",
    "m&s food",
    "meat",
    "milk",
    "mince",
    "morrisons",
    "ocado",
    "oil",
    "onions",
    "oranges",
    "pantry",
    "pepper",
    "pasta",
    "pork",
    "potatoes",
    "poultry",
    "ready meal",
    "ready meals",
    "rice",
    "salad",
    "sainsbury",
    "sainsburys",
    "sainsbury's",
    "salt",
    "sausage",
    "seafood",
    "soft drink",
    "snacks",
    "soap",
    "spices",
    "squash",
    "sugar",
    "supermarket",
    "tesco",
    "tomatoes",
    "toilet roll",
    "turkey",
    "washing powder",
    "veg",
    "vegetables",
    "waitrose",
    "water",
    "whole foods",
    "yoghurt",
  ],
  FOOD: [
    "ask italian",
    "bar",
    "barista",
    "bill's",
    "bills restaurant",
    "breakfast",
    "brunch",
    "burrito",
    "burger",
    "burger king",
    "cafe",
    "caffe nero",
    "cake",
    "canteen",
    "cappuccino",
    "carvery",
    "chicken shop",
    "chip shop",
    "costa",
    "coffee",
    "coffee shop",
    "coke",
    "cote",
    "dessert",
    "deliveroo",
    "dinner",
    "dominos",
    "doner",
    "doughnut",
    "eat out",
    "espresso",
    "fast food",
    "five guys",
    "franco manca",
    "gbk",
    "greggs",
    "grill",
    "honest burger",
    "ice cream",
    "just eat",
    "justeat",
    "kebab",
    "kfc",
    "krispy kreme",
    "latte",
    "leon",
    "lunch",
    "mexican food",
    "mcdonalds",
    "mcdonald's",
    "meal deal",
    "nandos",
    "nando's",
    "noodle",
    "papa johns",
    "papa john's",
    "pastry",
    "patisserie",
    "pizza",
    "pizza express",
    "pizzeria",
    "pret",
    "pub",
    "ramen",
    "restaurant",
    "roti",
    "sandwich",
    "snack",
    "steakhouse",
    "starbucks",
    "subway",
    "sushi",
    "take away",
    "takeaway",
    "taco bell",
    "thai food",
    "tea",
    "tortilla",
    "ubereats",
    "uber eats",
    "wagamama",
    "wasabi",
    "wetherspoon",
    "wetherspoons",
    "wendys",
    "wendy's",
    "yo sushi",
    "zizzi",
  ],
  TRANSPORT: [
    "airport",
    "airline",
    "avanti",
    "black cab",
    "bolt",
    "bp",
    "british airways",
    "bus",
    "bus pass",
    "cab",
    "car wash",
    "car park",
    "charging station",
    "coach",
    "commute",
    "congestion charge",
    "crosscountry",
    "dart charge",
    "diesel",
    "easyjet",
    "ev charge",
    "eurostar",
    "flight",
    "fuel",
    "gatwick express",
    "go ahead",
    "greater anglia",
    "gwr",
    "heathrow express",
    "jet2",
    "lime",
    "london north eastern railway",
    "lner",
    "lyft",
    "megabus",
    "merseyrail",
    "national rail",
    "national express",
    "oyster",
    "parking",
    "parking fine",
    "petrol",
    "petrol station",
    "rail",
    "railcard",
    "road tax",
    "ryanair",
    "scooter",
    "shell",
    "south western railway",
    "southern rail",
    "stansted express",
    "taxi",
    "tfl",
    "ticket",
    "train",
    "trainline",
    "tram",
    "transpennine",
    "travelcard",
    "tube",
    "uber",
    "underground",
    "vehicle hire",
    "vehicle tax",
    "virgin trains",
    "wizz air",
  ],
  BILLS: [
    "adobe",
    "apple icloud",
    "apple music",
    "audible",
    "boiler cover",
    "broadband",
    "bt",
    "building insurance",
    "car insurance",
    "council",
    "council tax",
    "deezer",
    "direct debit",
    "disney plus",
    "dropbox",
    "ee",
    "electric",
    "electricity",
    "energy",
    "energy bill",
    "finance payment",
    "gas",
    "gas bill",
    "giffgaff",
    "google storage",
    "health insurance",
    "gym membership",
    "homecare",
    "home insurance",
    "house insurance",
    "insurance",
    "internet",
    "internet bill",
    "life insurance",
    "license fee",
    "licence fee",
    "membership",
    "mobile bill",
    "mortgage",
    "now tv",
    "netflix",
    "octopus energy",
    "o2",
    "parking permit",
    "phone bill",
    "phone contract",
    "prime video",
    "rent",
    "roadside assistance",
    "sim only",
    "service charge",
    "sky",
    "sky broadband",
    "spotify",
    "standing order",
    "storage plan",
    "subscription",
    "tenant insurance",
    "tax",
    "three mobile",
    "tv licence",
    "utility",
    "virgin media",
    "vodafone",
    "water bill",
    "web hosting",
    "wifi",
    "youtube premium",
  ],
  SANDS: [
    "client lunch",
    "company expense",
    "company fuel",
    "company travel",
    "conference",
    "corporate card",
    "expense claim",
    "fuel card",
    "hotel work",
    "invoice sands",
    "mileage",
    "office supplies",
    "parking work",
    "per diem",
    "reimbursable",
    "sands",
    "sands expense",
    "staff travel",
    "team lunch",
    "total energies",
    "totalenergies",
    "train work",
    "travel expense",
    "work expense",
    "work hotel",
    "work lunch",
    "work parking",
    "work taxi",
    "work train",
    "work travel",
  ],
  INCOME: [
    "benefit",
    "benefits",
    "bonus",
    "cashback",
    "child benefit",
    "commission",
    "credit",
    "dividend",
    "expense reimbursement",
    "hmrc",
    "income",
    "interest",
    "pay",
    "payment",
    "payroll",
    "pension",
    "rebate",
    "refund",
    "refunded",
    "reimbursement",
    "repayment",
    "salary",
    "self assessment",
    "tax refund",
    "transfer in",
    "uc",
    "universal credit",
    "wage",
    "wages",
  ],
  SHOPPING: [
    "amazon",
    "argos",
    "asos",
    "adidas",
    "b and q",
    "b&q",
    "beauty",
    "book",
    "bookshop",
    "boots",
    "bought",
    "camera",
    "carphone warehouse",
    "clothes",
    "clothing",
    "cosmetics",
    "currys",
    "debenhams",
    "decathlon",
    "ebay",
    "electronics",
    "etsy",
    "fashion",
    "furniture",
    "game",
    "garden centre",
    "gift",
    "h and m",
    "h&m",
    "hardware",
    "homebase",
    "home goods",
    "household",
    "ikea",
    "jd sports",
    "john lewis",
    "laptop",
    "lego",
    "makeup",
    "next",
    "nike",
    "office",
    "online order",
    "paypal",
    "primark",
    "purchase",
    "river island",
    "sainsbury argos",
    "screwfix",
    "shein",
    "shoes",
    "shop",
    "shopping",
    "smartphone",
    "sportswear",
    "sports direct",
    "stationery",
    "superdrug",
    "temu",
    "the range",
    "tk maxx",
    "uniqlo",
    "vinted",
    "wilko",
    "zara",
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
  source: "user" | "built-in";
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
    confidence: source === "user" ? (phraseMatch ? 0.98 : 0.94) : phraseMatch ? 0.9 : 0.84,
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

export function categoriseExpense({
  text,
  amount,
  userRules = [],
}: {
  text: string;
  amount?: number | string | null;
  userRules?: ExpenseCategoryRuleInput[];
}): ExpenseCategorisation {
  const normalisedText = normaliseExpenseText(text);
  const userMatch = matchRules({
    text: normalisedText,
    rules: userRules,
    source: "user",
  });

  if (userMatch) {
    return userMatch;
  }

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
      confidence: 0.96,
      source: "amount",
    };
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

  return category.charAt(0) + category.slice(1).toLowerCase();
}

const ignoredAliasWords = new Set([
  "account",
  "bank",
  "card",
  "credit",
  "debit",
  "the",
]);

export function normaliseAccountAlias(alias: string) {
  return alias
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function defaultAliasFromAccountName(name: string) {
  const words = normaliseAccountAlias(name)
    .split(" ")
    .filter(Boolean)
    .filter((word) => !ignoredAliasWords.has(word));

  return words[0] ?? "";
}

export function parseAccountAliases(value: string, accountName?: string) {
  const aliases = Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map(normaliseAccountAlias)
        .filter(Boolean),
    ),
  );

  if (aliases.length > 0 || !accountName) {
    return aliases;
  }

  const defaultAlias = defaultAliasFromAccountName(accountName);

  return defaultAlias ? [defaultAlias] : [];
}

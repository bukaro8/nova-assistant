export const defaultCurrency = {
  code: "GBP",
  symbol: "£",
  locale: "en-GB",
} as const;

export function formatCurrency(value: number) {
  return new Intl.NumberFormat(defaultCurrency.locale, {
    style: "currency",
    currency: defaultCurrency.code,
  }).format(value);
}

export function formatCurrencyShort(value: number) {
  return `${defaultCurrency.symbol}${value.toFixed(2)}`;
}

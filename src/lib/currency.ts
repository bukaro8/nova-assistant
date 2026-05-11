export const currencyOptions = [
  { code: "GBP", symbol: "£", locale: "en-GB", label: "GBP" },
  { code: "USD", symbol: "$", locale: "en-US", label: "USD" },
  { code: "EUR", symbol: "€", locale: "en-IE", label: "EUR" },
  { code: "COP", symbol: "$", locale: "es-CO", label: "COP" },
] as const;

export type CurrencyCode = (typeof currencyOptions)[number]["code"];

export const defaultCurrency = currencyOptions[0];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return currencyOptions.some((option) => option.code === value);
}

export function getCurrencyOption(currency: string | null | undefined) {
  return (
    currencyOptions.find((option) => option.code === currency) ??
    defaultCurrency
  );
}

export function formatCurrency(value: number, currency?: string | null) {
  const option = getCurrencyOption(currency);

  return new Intl.NumberFormat(option.locale, {
    style: "currency",
    currency: option.code,
  }).format(value);
}

export function formatCurrencyShort(value: number, currency?: string | null) {
  const option = getCurrencyOption(currency);

  return `${option.symbol}${value.toFixed(2)}`;
}

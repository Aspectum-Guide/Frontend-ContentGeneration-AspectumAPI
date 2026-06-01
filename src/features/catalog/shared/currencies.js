/**
 * Currency helpers for booking catalog forms / displays.
 */

export const CURRENCIES = ['EUR', 'USD', 'RUB'];
export const DEFAULT_CURRENCY = 'EUR';

export function normalizeCurrency(value) {
  return String(value || DEFAULT_CURRENCY).toUpperCase();
}

/**
 * Format amount with currency. Keeps the same visual format the project used:
 * `${amount} ${CUR}` — non-locale, monospace-friendly.
 */
export function formatMoney(amount, currency) {
  const cur = normalizeCurrency(currency);
  if (amount == null || amount === '') return `— ${cur}`;
  return `${amount} ${cur}`;
}

// Currency utilities for formatting and conversion

export const CURRENCIES = {
  USD: { symbol: '$', name: 'US Dollar', code: 'USD' },
  EUR: { symbol: '€', name: 'Euro', code: 'EUR' },
  GBP: { symbol: '£', name: 'British Pound', code: 'GBP' },
  INR: { symbol: '₹', name: 'Indian Rupee', code: 'INR' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', code: 'AUD' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', code: 'CAD' },
  JPY: { symbol: '¥', name: 'Japanese Yen', code: 'JPY' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', code: 'CNY' },
  CHF: { symbol: 'Fr', name: 'Swiss Franc', code: 'CHF' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', code: 'SGD' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', code: 'AED' },
  BRL: { symbol: 'R$', name: 'Brazilian Real', code: 'BRL' },
  MXN: { symbol: '$', name: 'Mexican Peso', code: 'MXN' },
  ZAR: { symbol: 'R', name: 'South African Rand', code: 'ZAR' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

/** Product-wide fallback when company/customer/user have no currency set. */
export const PRODUCT_DEFAULT_CURRENCY: CurrencyCode = 'INR';

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && value in CURRENCIES;
}

export function normalizeCurrencyCode(
  value: unknown,
  fallback: CurrencyCode = PRODUCT_DEFAULT_CURRENCY
): CurrencyCode {
  if (typeof value !== 'string') return fallback;
  const upper = value.trim().toUpperCase();
  return isCurrencyCode(upper) ? upper : fallback;
}

export const CURRENCY_OPTIONS = (Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => ({
  code,
  label: `${code} - ${CURRENCIES[code].name} (${CURRENCIES[code].symbol})`,
}));

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param currency - The currency code (default: product default)
 * @param options - Intl.NumberFormat options
 */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode | string = PRODUCT_DEFAULT_CURRENCY,
  options?: Intl.NumberFormatOptions
): string {
  const code = normalizeCurrencyCode(currency);
  const currencyInfo = CURRENCIES[code];
  
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyInfo.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...options,
    }).format(amount);
  } catch (error) {
    // Fallback for unsupported currencies
    return `${currencyInfo.symbol}${amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }
}

/**
 * Get currency symbol
 * @param currency - The currency code
 */
export function getCurrencySymbol(currency: CurrencyCode | string = PRODUCT_DEFAULT_CURRENCY): string {
  return CURRENCIES[normalizeCurrencyCode(currency)]?.symbol || '₹';
}

/**
 * Get currency name
 * @param currency - The currency code
 */
export function getCurrencyName(currency: CurrencyCode | string = PRODUCT_DEFAULT_CURRENCY): string {
  return CURRENCIES[normalizeCurrencyCode(currency)]?.name || 'Indian Rupee';
}

/**
 * Parse a currency string to number
 * @param value - The currency string to parse
 */
export function parseCurrency(value: string): number {
  // Remove all non-numeric characters except decimal point and minus sign
  const cleanValue = value.replace(/[^\d.-]/g, '');
  return parseFloat(cleanValue) || 0;
}

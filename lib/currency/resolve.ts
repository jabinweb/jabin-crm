import {
  CURRENCIES,
  PRODUCT_DEFAULT_CURRENCY,
  isCurrencyCode,
  normalizeCurrencyCode,
  type CurrencyCode,
  formatCurrency as formatCurrencyUtil,
} from '@/lib/currency';

export { PRODUCT_DEFAULT_CURRENCY, isCurrencyCode, normalizeCurrencyCode };
export type { CurrencyCode };

/**
 * Pure resolution order (industry standard):
 * document/explicit → customer billing → company default → user preference → product default
 */
export function resolveCurrency(params: {
  explicit?: string | null;
  customerBillingCurrency?: string | null;
  companyDefaultCurrency?: string | null;
  userPreferredCurrency?: string | null;
}): CurrencyCode {
  if (isCurrencyCode(params.explicit?.trim().toUpperCase())) {
    return params.explicit!.trim().toUpperCase() as CurrencyCode;
  }
  if (isCurrencyCode(params.customerBillingCurrency?.trim().toUpperCase())) {
    return params.customerBillingCurrency!.trim().toUpperCase() as CurrencyCode;
  }
  if (isCurrencyCode(params.companyDefaultCurrency?.trim().toUpperCase())) {
    return params.companyDefaultCurrency!.trim().toUpperCase() as CurrencyCode;
  }
  if (isCurrencyCode(params.userPreferredCurrency?.trim().toUpperCase())) {
    return params.userPreferredCurrency!.trim().toUpperCase() as CurrencyCode;
  }
  return PRODUCT_DEFAULT_CURRENCY;
}

/** Read company default from Company.settings JSON. */
export function companyDefaultCurrencyFromSettings(settings: unknown): CurrencyCode | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  const root = settings as Record<string, unknown>;
  const billing = root.billing;
  if (billing && typeof billing === 'object' && !Array.isArray(billing)) {
    const code = (billing as Record<string, unknown>).defaultCurrency;
    if (typeof code === 'string' && isCurrencyCode(code.trim().toUpperCase())) {
      return code.trim().toUpperCase() as CurrencyCode;
    }
  }
  return null;
}

export type ResolveDocumentCurrencyInput = {
  /** Explicit currency from the request/form (wins if valid). */
  explicit?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  companyId?: string | null;
  userId?: string | null;
};

export function formatMoney(amount: number, currency: string): string {
  return formatCurrencyUtil(amount, normalizeCurrencyCode(currency));
}

export { CURRENCIES, formatCurrencyUtil as formatCurrency };

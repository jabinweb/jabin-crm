import { describe, expect, it } from '@jest/globals';
import {
  companyDefaultCurrencyFromSettings,
  resolveCurrency,
} from '@/lib/currency/resolve';

describe('resolveCurrency', () => {
  it('prefers explicit document currency', () => {
    expect(
      resolveCurrency({
        explicit: 'EUR',
        customerBillingCurrency: 'USD',
        companyDefaultCurrency: 'INR',
        userPreferredCurrency: 'GBP',
      })
    ).toBe('EUR');
  });

  it('uses customer billing currency over company default', () => {
    expect(
      resolveCurrency({
        customerBillingCurrency: 'USD',
        companyDefaultCurrency: 'INR',
        userPreferredCurrency: 'GBP',
      })
    ).toBe('USD');
  });

  it('falls back to company then user then product default', () => {
    expect(
      resolveCurrency({
        companyDefaultCurrency: 'AED',
        userPreferredCurrency: 'GBP',
      })
    ).toBe('AED');

    expect(
      resolveCurrency({
        userPreferredCurrency: 'GBP',
      })
    ).toBe('GBP');

    expect(resolveCurrency({})).toBe('INR');
  });

  it('ignores invalid codes', () => {
    expect(
      resolveCurrency({
        explicit: 'NOTREAL',
        customerBillingCurrency: 'usd',
      })
    ).toBe('USD');
  });
});

describe('companyDefaultCurrencyFromSettings', () => {
  it('reads billing.defaultCurrency', () => {
    expect(
      companyDefaultCurrencyFromSettings({
        billing: { defaultCurrency: 'SGD' },
      })
    ).toBe('SGD');
  });

  it('returns null when missing', () => {
    expect(companyDefaultCurrencyFromSettings({})).toBeNull();
    expect(companyDefaultCurrencyFromSettings(null)).toBeNull();
  });
});

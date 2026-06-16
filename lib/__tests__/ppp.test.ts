import {
  applyPppMultiplier,
  getPppTier,
  localizePlanPrice,
} from '@/lib/pricing/ppp';
import {
  convertInrPaiseToLocalMinor,
  formatPlanPrice,
  getCurrencyForCountry,
} from '@/lib/pricing/currency';

describe('PPP pricing', () => {
  it('keeps India at base price in INR', () => {
    const result = localizePlanPrice(99900, 'IN');
    expect(result.price).toBe(99900);
    expect(result.displayCurrency).toBe('INR');
    expect(result.formattedPrice).toMatch(/₹/);
    expect(result.savingsPercent).toBeNull();
  });

  it('shows USD for United States with premium PPP', () => {
    const result = localizePlanPrice(99900, 'US');
    expect(result.displayCurrency).toBe('USD');
    expect(result.formattedPrice).toMatch(/\$/);
    expect(result.price).toBeGreaterThan(99900);
  });

  it('shows PKR for Pakistan with PPP discount', () => {
    const result = localizePlanPrice(99900, 'PK');
    expect(result.displayCurrency).toBe('PKR');
    expect(result.formattedPrice).toMatch(/PKR|Rs/);
    expect(result.price).toBeLessThan(99900);
    expect(result.savingsPercent).toBeGreaterThan(0);
  });

  it('rounds to whole rupees for INR charge amount', () => {
    expect(applyPppMultiplier(99900, 0.6)).toBe(59900);
  });

  it('returns zero for free plans', () => {
    const result = localizePlanPrice(0, 'US');
    expect(result.formattedPrice).toBe('Free');
  });

  it('uses international tier for unknown countries', () => {
    const tier = getPppTier('ZZ');
    expect(tier.tier).toBe('international');
    expect(getCurrencyForCountry('ZZ')).toBe('USD');
  });
});

describe('currency conversion', () => {
  it('converts INR paise to USD cents', () => {
    const usdMinor = convertInrPaiseToLocalMinor(99900, 'USD');
    expect(usdMinor).toBeGreaterThan(100);
    expect(formatPlanPrice(usdMinor, 'USD')).toMatch(/\$/);
  });

  it('keeps INR unchanged', () => {
    expect(convertInrPaiseToLocalMinor(99900, 'INR')).toBe(99900);
  });
});

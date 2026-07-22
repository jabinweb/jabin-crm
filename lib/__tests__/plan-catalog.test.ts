import { describe, expect, it } from '@jest/globals';
import { PLAN_LIST_PRICES_PAISE } from '@/lib/pricing/catalog';
import { localizePlanPrice, getPppTier } from '@/lib/pricing/ppp';

describe('plan catalog + PPP', () => {
  it('keeps India list prices stable', () => {
    expect(PLAN_LIST_PRICES_PAISE.starter / 100).toBe(5999);
    expect(PLAN_LIST_PRICES_PAISE.professional / 100).toBe(14999);
    expect(PLAN_LIST_PRICES_PAISE.enterprise / 100).toBe(22999);
  });

  it('applies international PPP for US', () => {
    expect(getPppTier('US').multiplier).toBe(1.2);
    const us = localizePlanPrice(PLAN_LIST_PRICES_PAISE.professional, 'US');
    expect(us.price).toBe(1799900);
    expect(us.displayCurrency).toBe('USD');
  });

  it('applies developing PPP discount for PK', () => {
    expect(getPppTier('PK').multiplier).toBe(0.6);
    const pk = localizePlanPrice(PLAN_LIST_PRICES_PAISE.professional, 'PK');
    expect(pk.price).toBeLessThan(PLAN_LIST_PRICES_PAISE.professional);
    expect(pk.savingsPercent).toBeGreaterThan(0);
  });
});

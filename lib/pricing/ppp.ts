/**
 * Purchase power parity multipliers relative to India (IN = 1.0 base).
 * Base plan prices in the database are INR list prices for India.
 */

import {
  convertInrPaiseToLocalMinor,
  formatPlanPrice,
  getCurrencyForCountry,
} from '@/lib/pricing/currency';

export type PppTier =
  | 'base'
  | 'international'
  | 'emerging'
  | 'developing'
  | 'frontier';

export type PppTierInfo = {
  tier: PppTier;
  multiplier: number;
  label: string;
};

/** Premium markets — slightly above India list (international B2B SaaS norm). */
const INTERNATIONAL = new Set([
  'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI',
  'CH', 'AT', 'IE', 'AU', 'NZ', 'SG', 'JP', 'KR', 'AE', 'IL', 'HK', 'LU',
]);

const BASE = new Set(['IN']);

const EMERGING = new Set([
  'MY', 'TH', 'MX', 'BR', 'CL', 'AR', 'CO', 'PE', 'ZA', 'TR', 'PL', 'CZ', 'HU',
  'RO', 'BG', 'HR', 'RS', 'CN', 'TW', 'SA', 'QA', 'KW', 'OM', 'BH',
]);

const DEVELOPING = new Set([
  'PK', 'BD', 'LK', 'NP', 'PH', 'ID', 'VN', 'EG', 'MA', 'TN', 'JO', 'LB', 'IQ',
  'UA', 'KZ', 'UZ', 'BO', 'EC', 'PY', 'DO', 'GT', 'HN', 'SV', 'NI', 'CR', 'PA',
]);

const FRONTIER = new Set([
  'NG', 'KE', 'GH', 'TZ', 'UG', 'RW', 'ET', 'SN', 'CI', 'CM', 'ZM', 'ZW', 'MW',
  'MZ', 'AO', 'BF', 'ML', 'NE', 'TD', 'SD', 'MM', 'KH', 'LA', 'AF', 'YE', 'HT',
]);

const TIER_CONFIG: Record<PppTier, Omit<PppTierInfo, 'tier'>> = {
  base: { multiplier: 1, label: 'Best local rate' },
  international: { multiplier: 1.2, label: 'Standard rate' },
  emerging: { multiplier: 0.85, label: 'Regional rate' },
  developing: { multiplier: 0.6, label: 'Value rate' },
  frontier: { multiplier: 0.4, label: 'Value rate' },
};

export function getPppTier(countryCode: string): PppTierInfo {
  const code = countryCode.toUpperCase();

  if (BASE.has(code)) return { tier: 'base', ...TIER_CONFIG.base };
  if (INTERNATIONAL.has(code)) return { tier: 'international', ...TIER_CONFIG.international };
  if (EMERGING.has(code)) return { tier: 'emerging', ...TIER_CONFIG.emerging };
  if (DEVELOPING.has(code)) return { tier: 'developing', ...TIER_CONFIG.developing };
  if (FRONTIER.has(code)) return { tier: 'frontier', ...TIER_CONFIG.frontier };

  return { tier: 'international', ...TIER_CONFIG.international };
}

/** Round to whole rupees; paid plans have a ₹1 minimum. */
export function applyPppMultiplier(basePricePaise: number, multiplier: number): number {
  if (basePricePaise <= 0) return 0;
  const adjusted = basePricePaise * multiplier;
  const rounded = Math.round(adjusted / 100) * 100;
  return Math.max(rounded, 100);
}

export type LocalizedPlanPrice = {
  /** INR paise — India list price from DB */
  basePrice: number;
  /** INR paise — amount charged via Razorpay after PPP */
  price: number;
  /** Always INR for Razorpay settlement */
  currency: 'INR';
  /** Visitor's local currency */
  displayCurrency: string;
  /** Local currency minor units (cents, paisa, etc.) after PPP + FX */
  displayAmount: number;
  /** Local list price (India base converted to local FX, before PPP discount) */
  baseDisplayAmount: number;
  formattedPrice: string;
  formattedBasePrice: string;
  pppMultiplier: number;
  pppTier: PppTier;
  pppLabel: string;
  countryCode: string;
  savingsPercent: number | null;
};

export function localizePlanPrice(basePricePaise: number, countryCode: string): LocalizedPlanPrice {
  const code = countryCode.toUpperCase();
  const tierInfo = getPppTier(code);
  const displayCurrency = getCurrencyForCountry(code);

  const priceInrPaise = applyPppMultiplier(basePricePaise, tierInfo.multiplier);
  const displayAmount = convertInrPaiseToLocalMinor(priceInrPaise, displayCurrency);
  const baseDisplayAmount = convertInrPaiseToLocalMinor(basePricePaise, displayCurrency);

  const savingsPercent =
    baseDisplayAmount > 0 && displayAmount < baseDisplayAmount
      ? Math.round((1 - displayAmount / baseDisplayAmount) * 100)
      : null;

  return {
    basePrice: basePricePaise,
    price: priceInrPaise,
    currency: 'INR',
    displayCurrency,
    displayAmount,
    baseDisplayAmount,
    formattedPrice: formatPlanPrice(displayAmount, displayCurrency),
    formattedBasePrice: formatPlanPrice(baseDisplayAmount, displayCurrency),
    pppMultiplier: tierInfo.multiplier,
    pppTier: tierInfo.tier,
    pppLabel: tierInfo.label,
    countryCode: code,
    savingsPercent,
  };
}

/** @deprecated Use formatPlanPrice(displayAmount, displayCurrency) */
export function formatInrPrice(paise: number): string {
  return formatPlanPrice(paise, 'INR');
}

export { PPP_COUNTRY_OPTIONS } from '@/lib/pricing/currency';

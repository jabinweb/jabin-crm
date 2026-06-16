/** ISO 4217 currency for a country (primary billing/display currency). */
const COUNTRY_CURRENCY: Record<string, string> = {
  IN: 'INR',
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  AU: 'AUD',
  NZ: 'NZD',
  SG: 'SGD',
  JP: 'JPY',
  KR: 'KRW',
  AE: 'AED',
  SA: 'SAR',
  PK: 'PKR',
  BD: 'BDT',
  LK: 'LKR',
  NP: 'NPR',
  PH: 'PHP',
  ID: 'IDR',
  VN: 'VND',
  NG: 'NGN',
  KE: 'KES',
  GH: 'GHS',
  ZA: 'ZAR',
  BR: 'BRL',
  MX: 'MXN',
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
  EG: 'EGP',
  TR: 'TRY',
  PL: 'PLN',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  MY: 'MYR',
  TH: 'THB',
  HK: 'HKD',
  IL: 'ILS',
  CN: 'CNY',
  TW: 'TWD',
  QA: 'QAR',
  KW: 'KWD',
  OM: 'OMR',
  BH: 'BHD',
  RO: 'RON',
  CZ: 'CZK',
  HU: 'HUF',
  UA: 'UAH',
  // Eurozone
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  LU: 'EUR',
};

/** Local currency major units received per 1 INR (update periodically). */
const INR_EXCHANGE_RATES: Record<string, number> = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0094,
  CAD: 0.016,
  AUD: 0.018,
  NZD: 0.019,
  SGD: 0.016,
  JPY: 1.78,
  KRW: 16.2,
  AED: 0.044,
  SAR: 0.045,
  PKR: 3.35,
  BDT: 1.42,
  LKR: 3.55,
  NPR: 1.6,
  PHP: 0.67,
  IDR: 189,
  VND: 295,
  NGN: 18.5,
  KES: 1.55,
  GHS: 0.15,
  ZAR: 0.22,
  BRL: 0.067,
  MXN: 0.22,
  ARS: 10.5,
  CLP: 11.2,
  COP: 48,
  EGP: 0.58,
  TRY: 0.41,
  PLN: 0.047,
  CHF: 0.0105,
  SEK: 0.13,
  NOK: 0.13,
  DKK: 0.082,
  MYR: 0.056,
  THB: 0.42,
  HKD: 0.094,
  ILS: 0.044,
  CNY: 0.087,
  TWD: 0.38,
  QAR: 0.044,
  KWD: 0.0037,
  OMR: 0.0046,
  BHD: 0.0045,
  RON: 0.055,
  CZK: 0.28,
  HUF: 4.35,
  UAH: 0.49,
};

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'UGX', 'RWF']);

export function getCurrencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? 'USD';
}

export function getInrExchangeRate(currency: string): number {
  return INR_EXCHANGE_RATES[currency.toUpperCase()] ?? INR_EXCHANGE_RATES.USD;
}

export function getMinorUnitExponent(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

/** Convert INR paise → local currency minor units (cents, fils, etc.). */
export function convertInrPaiseToLocalMinor(
  inrPaise: number,
  targetCurrency: string
): number {
  if (inrPaise <= 0) return 0;

  const currency = targetCurrency.toUpperCase();
  if (currency === 'INR') return inrPaise;

  const inrMajor = inrPaise / 100;
  const localMajor = inrMajor * getInrExchangeRate(currency);
  const exponent = getMinorUnitExponent(currency);

  if (exponent === 0) {
    return Math.max(Math.round(localMajor), 1);
  }

  const minor = Math.round(localMajor * 100);
  return Math.max(minor, 100);
}

export function formatPlanPrice(minorUnits: number, currency: string, locale?: string): string {
  if (minorUnits <= 0) return 'Free';

  const code = currency.toUpperCase();
  const exponent = getMinorUnitExponent(code);
  const major = exponent === 0 ? minorUnits : minorUnits / 100;

  const resolvedLocale =
    locale ??
    ({
      INR: 'en-IN',
      USD: 'en-US',
      GBP: 'en-GB',
      EUR: 'de-DE',
      PKR: 'en-PK',
      BDT: 'en-BD',
      NGN: 'en-NG',
      JPY: 'ja-JP',
      BRL: 'pt-BR',
      MXN: 'es-MX',
    }[code] ??
      'en-US');

  return major.toLocaleString(resolvedLocale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: exponent,
    minimumFractionDigits: exponent,
  });
}

export const PPP_COUNTRY_OPTIONS = [
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT' },
  { code: 'PH', name: 'Philippines', currency: 'PHP' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN' },
  { code: 'KE', name: 'Kenya', currency: 'KES' },
  { code: 'BR', name: 'Brazil', currency: 'BRL' },
  { code: 'MX', name: 'Mexico', currency: 'MXN' },
] as const;

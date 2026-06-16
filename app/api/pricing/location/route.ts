import { NextRequest, NextResponse } from 'next/server';
import { COUNTRY_COOKIE, normalizeCountryCode } from '@/lib/geo/request-location';
import { getPppTier } from '@/lib/pricing/ppp';
import { getCurrencyForCountry } from '@/lib/pricing/currency';

export async function GET(req: NextRequest) {
  const country = normalizeCountryCode(req.cookies.get(COUNTRY_COOKIE)?.value);
  const headerCountry = normalizeCountryCode(
    req.headers.get('x-geo-country') ||
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('cf-ipcountry')
  );

  const countryCode = country ?? headerCountry ?? 'IN';
  const tier = getPppTier(countryCode);
  const currency = getCurrencyForCountry(countryCode);

  return NextResponse.json({
    countryCode,
    currency,
    detectedCountryCode: headerCountry,
    cookieCountryCode: country,
    pppTier: tier.tier,
    pppMultiplier: tier.multiplier,
    pppLabel: tier.label,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const countryCode = normalizeCountryCode(body?.countryCode);

    if (!countryCode) {
      return NextResponse.json({ error: 'Invalid country code' }, { status: 400 });
    }

    const tier = getPppTier(countryCode);
    const currency = getCurrencyForCountry(countryCode);
    const res = NextResponse.json({
      countryCode,
      currency,
      pppTier: tier.tier,
      pppMultiplier: tier.multiplier,
      pppLabel: tier.label,
    });

    res.cookies.set(COUNTRY_COOKIE, countryCode, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 90,
      path: '/',
    });

    return res;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { getPlatformTenancyConfig } from '@/lib/tenancy/platform-settings';
import { getAppHost } from '@/lib/tenancy/mode';
import { getAppBaseUrl } from '@/lib/app-url';

/** Public tenancy display config for /start and marketing. */
export async function GET() {
  const config = await getPlatformTenancyConfig();
  const appUrl = getAppBaseUrl();

  return NextResponse.json({
    tenancyMode: config.tenancyMode,
    host: getAppHost(appUrl),
  });
}

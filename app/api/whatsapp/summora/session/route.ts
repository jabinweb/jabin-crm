import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';

async function getSummoraCreds(userId: string) {
  const config = await prisma.whatsAppProviderConfig.findUnique({
    where: { userId },
  });
  if (!config || config.provider !== 'SUMMORA' || !config.isActive) {
    return { error: 'Summora WhatsApp provider is not active', status: 400 as const };
  }
  const baseUrl = String(config.summoraBaseUrl || '').replace(/\/$/, '');
  const apiKey = config.summoraApiKey ? decrypt(config.summoraApiKey) : '';
  if (!baseUrl || !apiKey) {
    return { error: 'Summora base URL or API key missing', status: 400 as const };
  }
  return { baseUrl, apiKey, config };
}

/** GET — live Summora WA session status (+ QR if connecting) */
export const GET = withSessionRoute(async (_req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const creds = await getSummoraCreds(userId);
  if ('error' in creds) {
    return NextResponse.json({ error: creds.error }, { status: creds.status });
  }

  const res = await fetch(`${creds.baseUrl}/api/v1/bridge/connection`, {
    headers: { Authorization: `Bearer ${creds.apiKey}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: body.error || 'Failed to fetch Summora connection' },
      { status: res.status }
    );
  }
  return jsonOk(body);
});

/** POST — { action: "start" | "disconnect", force?: boolean } */
export const POST = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const creds = await getSummoraCreds(userId);
  if ('error' in creds) {
    return NextResponse.json({ error: creds.error }, { status: creds.status });
  }

  const payload = await req.json().catch(() => ({}));
  const action = String(payload.action || '').toLowerCase();
  if (action !== 'start' && action !== 'disconnect') {
    return NextResponse.json(
      { error: 'action must be start or disconnect' },
      { status: 400 }
    );
  }

  const res = await fetch(`${creds.baseUrl}/api/v1/bridge/connection`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      force: payload.force === true,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: body.error || 'Summora session action failed' },
      { status: res.status }
    );
  }
  return jsonOk(body);
});

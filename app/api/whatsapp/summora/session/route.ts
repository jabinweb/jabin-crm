import { NextResponse } from 'next/server';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';
import { fetchSummoraBridge, getSummoraCreds } from '@/lib/crm/summora-bridge';

/** GET — live Summora WA session status (+ QR if connecting) */
export const GET = withSessionRoute(async (_req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const creds = await getSummoraCreds(userId);
  if ('error' in creds) {
    return NextResponse.json({ error: creds.error }, { status: creds.status });
  }

  const result = await fetchSummoraBridge(creds, '/api/v1/bridge/connection', {
    timeoutMs: 15_000,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return jsonOk(result.body);
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

  const result = await fetchSummoraBridge(creds, '/api/v1/bridge/connection', {
    method: 'POST',
    body: JSON.stringify({
      action,
      force: payload.force === true,
    }),
    timeoutMs: 30_000,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return jsonOk(result.body);
});

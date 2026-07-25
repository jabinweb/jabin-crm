import { NextResponse } from 'next/server';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';
import { fetchSummoraBridge, getSummoraCreds } from '@/lib/crm/summora-bridge';

/** GET — current WhatsApp inbox filter (ALL | GROUPS_ONLY | CUSTOM) */
export const GET = withSessionRoute(async (_req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const creds = await getSummoraCreds(userId);
  if ('error' in creds) {
    return NextResponse.json({ error: creds.error }, { status: creds.status });
  }

  const result = await fetchSummoraBridge(creds, '/api/v1/bridge/filters', {
    timeoutMs: 15_000,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return jsonOk(result.body);
});

/** PATCH — { filterType, allowedJids?, bridgePassthrough? } */
export const PATCH = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const creds = await getSummoraCreds(userId);
  if ('error' in creds) {
    return NextResponse.json({ error: creds.error }, { status: creds.status });
  }

  const payload = await req.json().catch(() => ({}));
  const result = await fetchSummoraBridge(creds, '/api/v1/bridge/filters', {
    method: 'PATCH',
    body: JSON.stringify({
      filterType: payload.filterType,
      allowedJids: payload.allowedJids,
      bridgePassthrough: payload.bridgePassthrough !== false,
    }),
    timeoutMs: 15_000,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return jsonOk(result.body);
});

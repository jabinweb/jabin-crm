import { NextResponse } from 'next/server';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute, jsonOk } from '@/lib/api/with-route';
import { fetchSummoraBridge, getSummoraCreds } from '@/lib/crm/summora-bridge';

/** GET — WhatsApp address-book / notify names for chat list labels */
export const GET = withSessionRoute(async (_req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const creds = await getSummoraCreds(userId);
  if ('error' in creds) {
    return NextResponse.json({ error: creds.error }, { status: creds.status });
  }

  const result = await fetchSummoraBridge(creds, '/api/v1/bridge/contacts', {
    timeoutMs: 12_000,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return jsonOk(result.body);
});

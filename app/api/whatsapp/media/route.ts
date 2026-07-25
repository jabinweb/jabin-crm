import { NextResponse } from 'next/server';
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { withSessionRoute } from '@/lib/api/with-route';
import { getSummoraCreds } from '@/lib/crm/summora-bridge';

/** GET /api/whatsapp/media?id= — proxy stored WhatsApp media from Summora */
export const GET = withSessionRoute(async (req, { userId }) => {
  await ensureFeatureEnabled(userId, 'WHATSAPP');
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const creds = await getSummoraCreds(userId);
  if ('error' in creds) {
    return NextResponse.json({ error: creds.error }, { status: creds.status });
  }

  try {
    const res = await fetch(
      `${creds.baseUrl}/api/v1/bridge/media?id=${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${creds.apiKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(60_000),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err as { error?: string }).error || 'Media not found' },
        { status: res.status }
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ctype = res.headers.get('content-type') || 'application/octet-stream';
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': ctype,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch media',
      },
      { status: 502 }
    );
  }
});

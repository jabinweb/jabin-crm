import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { WORKSPACE_SLUG_HEADER } from '@/lib/api/workspace-slug';
import { subscribe, type RealtimeEvent } from '@/lib/realtime/hub';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function requestWithCompanySlug(request: NextRequest): NextRequest {
  const companySlug = request.nextUrl.searchParams.get('company')?.trim();
  if (!companySlug || request.headers.get(WORKSPACE_SLUG_HEADER)) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.set(WORKSPACE_SLUG_HEADER, companySlug);
  return new NextRequest(request.url, { headers });
}

/**
 * Company-scoped SSE stream backed by the in-memory realtime hub.
 * Clients pass `?company=<slug>` because EventSource cannot send custom headers.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  let companyId: string;
  try {
    const tenant = await resolveCompanyContextFromRequest(
      session,
      requestWithCompanySlug(request)
    );
    companyId = tenant.companyId;
  } catch {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send({ type: 'connected', companyId, ts: Date.now() });

      unsubscribe = subscribe(companyId, (event: RealtimeEvent) => {
        send(event);
      });

      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        send({ type: 'heartbeat', ts: Date.now() });
      }, 20_000);

      setTimeout(() => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }, 58_000);
    },
    cancel() {
      closed = true;
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

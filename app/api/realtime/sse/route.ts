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
  // Staff stream only — portal customers belong to the company but must not see
  // other visitors' chats, every ticket change or internal project activity.
  if (session.user.role === 'CUSTOMER') {
    return new Response('Forbidden', { status: 403 });
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

      const viewerId = session.user.id;
      unsubscribe = subscribe(companyId, (event: RealtimeEvent) => {
        // Targeted events never reach other people in the company
        if (event.audience && !event.audience.includes(viewerId)) return;
        const { audience: _audience, ...rest } = event;
        send(rest);
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

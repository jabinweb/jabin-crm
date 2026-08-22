'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { RealtimeEvent } from '@/lib/realtime/hub';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export interface UseRealtimeOptions {
  enabled?: boolean;
  onEvent?: (event: RealtimeEvent) => void;
  /** When set, only invoke onEvent for matching event types. */
  types?: string[];
}

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { enabled = true, onEvent, types } = options;
  const { data: session } = useSession();
  const { slug } = useWorkspacePaths();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  const onEventRef = useRef(onEvent);
  const typesRef = useRef(types);
  onEventRef.current = onEvent;
  typesRef.current = types;

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const attemptRef = useRef(0);

  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!session?.user || !enabled) return;

    cleanup();

    const params = new URLSearchParams();
    if (slug) params.set('company', slug);
    const url = `/api/realtime/sse${params.size ? `?${params.toString()}` : ''}`;

    const source = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = source;

    source.onopen = () => {
      attemptRef.current = 0;
      setConnected(true);
    };

    source.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data) as RealtimeEvent & { type: string };
        if (data.type === 'heartbeat' || data.type === 'connected') return;

        const filter = typesRef.current;
        if (filter?.length && !filter.includes(data.type)) return;

        setLastEvent(data);
        onEventRef.current?.(data);
      } catch (err) {
        console.error('[useRealtime] parse error', err);
      }
    };

    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;
      setConnected(false);

      attemptRef.current += 1;
      const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attemptRef.current - 1));
      retryTimeoutRef.current = setTimeout(connect, delay);
    };
  }, [session?.user, enabled, slug, cleanup]);

  useEffect(() => {
    if (enabled && session?.user) {
      connect();
    } else {
      cleanup();
    }
    return cleanup;
  }, [connect, cleanup, enabled, session?.user]);

  return { connected, lastEvent };
}

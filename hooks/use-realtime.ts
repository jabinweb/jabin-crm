'use client';

import { useEffect, useRef, useState } from 'react';
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
/** The server ends each stream after ~58s; reconnecting after a clean cycle needs no backoff growth. */
const HEALTHY_STREAM_MS = 30_000;

type Listener = {
  onEvent: (event: RealtimeEvent) => void;
  onStatus: (connected: boolean) => void;
};

/**
 * One EventSource per workspace per tab, shared by every component that subscribes.
 * Each component used to open its own stream, multiplying connections and reconnects.
 */
class SharedStream {
  private source: EventSource | null = null;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private attempt = 0;
  private openedAt = 0;
  readonly listeners = new Set<Listener>();
  connected = false;

  constructor(private readonly url: string) {}

  add(listener: Listener) {
    this.listeners.add(listener);
    listener.onStatus(this.connected);
    if (!this.source && !this.retry) this.open();
  }

  remove(listener: Listener) {
    this.listeners.delete(listener);
    if (this.listeners.size === 0) this.close();
  }

  private setConnected(value: boolean) {
    this.connected = value;
    this.listeners.forEach((l) => l.onStatus(value));
  }

  private open() {
    this.retry = undefined;
    const source = new EventSource(this.url, { withCredentials: true });
    this.source = source;

    source.onopen = () => {
      this.openedAt = Date.now();
      this.attempt = 0;
      this.setConnected(true);
    };

    source.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data) as RealtimeEvent & { type: string };
        if (data.type === 'heartbeat' || data.type === 'connected') return;
        this.listeners.forEach((l) => l.onEvent(data));
      } catch (err) {
        console.error('[useRealtime] parse error', err);
      }
    };

    source.onerror = () => {
      source.close();
      if (this.source === source) this.source = null;
      this.setConnected(false);
      if (this.listeners.size === 0) return;

      // A stream that stayed up is the server's normal recycle — reconnect promptly.
      // Failures (401/429/network) back off exponentially, with jitter.
      const healthy = this.openedAt > 0 && Date.now() - this.openedAt >= HEALTHY_STREAM_MS;
      this.openedAt = 0;
      this.attempt = healthy ? 0 : this.attempt + 1;
      const base = healthy ? BASE_BACKOFF_MS : Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** this.attempt);
      const delay = base + Math.floor(Math.random() * 1_000);
      this.retry = setTimeout(() => this.open(), delay);
    };
  }

  private close() {
    if (this.retry) clearTimeout(this.retry);
    this.retry = undefined;
    this.source?.close();
    this.source = null;
    this.attempt = 0;
    this.connected = false;
    streams.delete(this.url);
  }
}

const streams = new Map<string, SharedStream>();

function streamFor(url: string) {
  let stream = streams.get(url);
  if (!stream) {
    stream = new SharedStream(url);
    streams.set(url, stream);
  }
  return stream;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { enabled = true, onEvent, types } = options;
  const { data: session } = useSession();
  // Depend on the id, not the user object — session refetches (e.g. on tab focus)
  // return a new object and used to tear down and reopen the stream.
  const userId = session?.user?.id;
  const { slug } = useWorkspacePaths();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  const onEventRef = useRef(onEvent);
  const typesRef = useRef(types);
  onEventRef.current = onEvent;
  typesRef.current = types;

  useEffect(() => {
    if (!enabled || !userId) {
      setConnected(false);
      return;
    }
    const params = new URLSearchParams();
    if (slug) params.set('company', slug);
    const url = `/api/realtime/sse${params.size ? `?${params.toString()}` : ''}`;

    const listener: Listener = {
      onStatus: setConnected,
      onEvent: (event) => {
        const filter = typesRef.current;
        if (filter?.length && !filter.includes(event.type)) return;
        setLastEvent(event);
        onEventRef.current?.(event);
      },
    };
    const stream = streamFor(url);
    stream.add(listener);
    return () => stream.remove(listener);
  }, [enabled, userId, slug]);

  return { connected, lastEvent };
}

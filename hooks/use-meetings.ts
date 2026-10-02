'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useRealtime } from '@/hooks/use-realtime';
import { REALTIME_EVENTS } from '@/lib/realtime/events';
import type {
  MeetingDTO,
  MeetingListResponse,
  MeetingsNowResponse,
  MeetingsVideoConfig,
} from '@/lib/meetings/types';
import type { Rsvp } from '@/lib/meetings/rules';

export const meetingsKeys = {
  all: (slug?: string) => ['meetings', slug] as const,
  list: (slug: string | undefined, scope: 'upcoming' | 'past') => ['meetings', slug, 'list', scope] as const,
  detail: (slug: string | undefined, id: string) => ['meetings', slug, 'detail', id] as const,
  now: (slug?: string) => ['meetings', slug, 'now'] as const,
};

/** Error carrying the API's `code` (e.g. MEETINGS_NOT_READY, VIDEO_NOT_CONFIGURED). */
export class MeetingApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function readJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new MeetingApiError(
      (data as { error?: string }).error || 'Something went wrong',
      res.status,
      (data as { code?: string }).code
    );
  }
  return data as T;
}

/** Refetch meeting queries whenever a meeting I'm part of changes (invite, RSVP, room). */
export function useMeetingsRealtime() {
  const queryClient = useQueryClient();
  const { slug } = useWorkspacePaths();
  useRealtime({
    types: [REALTIME_EVENTS.MEETING_UPDATED],
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: meetingsKeys.all(slug) });
      void queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useMeetingsList(scope: 'upcoming' | 'past') {
  const { slug, workspaceFetch } = useWorkspacePaths();
  return useQuery({
    queryKey: meetingsKeys.list(slug, scope),
    queryFn: async () => readJson<MeetingListResponse>(await workspaceFetch(`/api/meetings?scope=${scope}`)),
    enabled: !!slug,
    staleTime: 15_000,
    // Keeps "Live now" / countdowns honest without realtime
    refetchInterval: scope === 'upcoming' ? 60_000 : false,
    retry: (count, error) => !(error instanceof MeetingApiError && error.status < 500) && count < 2,
  });
}

export function useMeeting(id: string) {
  const { slug, workspaceFetch } = useWorkspacePaths();
  return useQuery({
    queryKey: meetingsKeys.detail(slug, id),
    queryFn: async () =>
      readJson<{ meeting: MeetingDTO; video: MeetingsVideoConfig }>(await workspaceFetch(`/api/meetings/${id}`)),
    enabled: !!slug && !!id,
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: (count, error) => !(error instanceof MeetingApiError && error.status < 500) && count < 2,
  });
}

/** Header indicator: live / starting-soon meetings, polled every minute while the tab is visible. */
export function useMeetingsNow() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const { data: session } = useSession();
  const isStaff = !!session?.user && session.user.role !== 'CUSTOMER';
  return useQuery({
    queryKey: meetingsKeys.now(slug),
    queryFn: async () => {
      const res = await workspaceFetch('/api/meetings/now');
      // Before the migration (503) or without a workspace: show nothing, quietly
      if (!res.ok) {
        return {
          meetings: [],
          pendingInvites: 0,
          video: { configured: false },
          ready: res.status !== 503,
        } satisfies MeetingsNowResponse;
      }
      return (await res.json()) as MeetingsNowResponse;
    },
    enabled: !!slug && isStaff,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useMeetingActions() {
  const queryClient = useQueryClient();
  const { slug, workspaceFetch } = useWorkspacePaths();

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: meetingsKeys.all(slug) });
    void queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
  }, [queryClient, slug]);

  const send = useCallback(
    async <T,>(url: string, init: RequestInit) =>
      readJson<T>(
        await workspaceFetch(url, {
          ...init,
          headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
        })
      ),
    [workspaceFetch]
  );

  const rsvp = useMutation({
    mutationFn: ({ id, rsvp }: { id: string; rsvp: Exclude<Rsvp, 'PENDING'> }) =>
      send<{ meeting: MeetingDTO }>(`/api/meetings/${id}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ rsvp }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(meetingsKeys.detail(slug, data.meeting.id), (prev: unknown) =>
        prev && typeof prev === 'object' ? { ...(prev as object), meeting: data.meeting } : prev
      );
      refresh();
    },
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      send<{ meeting: MeetingDTO; count: number }>('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({ ...body, timeZone: browserTimeZone() }),
      }),
    onSuccess: refresh,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      send<{ meeting: MeetingDTO }>(`/api/meetings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...body, timeZone: browserTimeZone() }),
      }),
    onSuccess: refresh,
  });

  const cancel = useMutation({
    mutationFn: ({ id, series }: { id: string; series?: boolean }) =>
      send<{ cancelled: number }>(
        `/api/meetings/${id}?${new URLSearchParams({ ...(series ? { series: '1' } : {}), tz: browserTimeZone() })}`,
        { method: 'DELETE' }
      ),
    onSuccess: refresh,
  });

  const end = useMutation({
    mutationFn: (id: string) => send<{ ok: true }>(`/api/meetings/${id}/end`, { method: 'POST' }),
    onSuccess: refresh,
  });

  /** Fire-and-forget; survives page unload. */
  const leave = useCallback(
    (id: string) => {
      void workspaceFetch(`/api/meetings/${id}/leave`, { method: 'POST', keepalive: true })
        .then(refresh)
        .catch(() => {});
    },
    [refresh, workspaceFetch]
  );

  return { rsvp, create, update, cancel, end, leave, refresh };
}

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

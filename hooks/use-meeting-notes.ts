'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { MeetingApiError, meetingsKeys } from '@/hooks/use-meetings';
import type { ActionItemDTO, MeetingNotesDTO } from '@/lib/meetings/ai-notes/types';

/** Under the meetings key, so meeting realtime events (toggle, notes ready) refetch it too. */
export const meetingNotesKeys = {
  all: (slug: string | undefined, id: string) => [...meetingsKeys.all(slug), 'notes', id] as const,
  full: (slug: string | undefined, id: string) => [...meetingsKeys.all(slug), 'notes', id, 'full'] as const,
  status: (slug: string | undefined, id: string) => [...meetingsKeys.all(slug), 'notes', id, 'status'] as const,
};

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

const noRetryOn4xx = (count: number, error: unknown) =>
  !(error instanceof MeetingApiError && error.status < 500) && count < 2;

/** Full notes (summary, items, transcript) for the meeting page. Polls while something is in progress. */
export function useMeetingNotes(id: string, opts: { enabled?: boolean } = {}) {
  const { slug, workspaceFetch } = useWorkspacePaths();
  return useQuery({
    queryKey: meetingNotesKeys.full(slug, id),
    queryFn: async () =>
      (await readJson<{ notes: MeetingNotesDTO }>(await workspaceFetch(`/api/meetings/${id}/notes`))).notes,
    enabled: !!slug && !!id && opts.enabled !== false,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const n = query.state.data as MeetingNotesDTO | undefined;
      if (!n) return false;
      if (n.generating) return 5_000;
      if (n.enabled) return 20_000;
      return false;
    },
    retry: noRetryOn4xx,
  });
}

/** Capture switch only (no transcript) — polled inside the call so everyone sees "AI notes on". */
export function useMeetingNotesStatus(id: string) {
  const { slug, workspaceFetch } = useWorkspacePaths();
  return useQuery({
    queryKey: meetingNotesKeys.status(slug, id),
    queryFn: async () =>
      (await readJson<{ notes: MeetingNotesDTO }>(await workspaceFetch(`/api/meetings/${id}/notes?view=status`))).notes,
    enabled: !!slug && !!id,
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    retry: noRetryOn4xx,
  });
}

/** Summary + items without the transcript, fetched once (calendar event sheet). */
export function useMeetingNotesPreview(id: string, enabled = true) {
  const { slug, workspaceFetch } = useWorkspacePaths();
  return useQuery({
    queryKey: [...meetingNotesKeys.all(slug, id), 'preview'] as const,
    queryFn: async () =>
      (await readJson<{ notes: MeetingNotesDTO }>(await workspaceFetch(`/api/meetings/${id}/notes?view=status`))).notes,
    enabled: !!slug && !!id && enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useMeetingNotesActions(id: string) {
  const queryClient = useQueryClient();
  const { slug, workspaceFetch } = useWorkspacePaths();

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: meetingNotesKeys.all(slug, id) });
  }, [queryClient, slug, id]);

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

  const patchItem = useCallback(
    (item: ActionItemDTO) => {
      queryClient.setQueryData(meetingNotesKeys.full(slug, id), (prev: MeetingNotesDTO | undefined) =>
        prev ? { ...prev, actionItems: prev.actionItems.map((i) => (i.id === item.id ? item : i)) } : prev
      );
    },
    [queryClient, slug, id]
  );

  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      send<{ notes: MeetingNotesDTO }>(`/api/meetings/${id}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(meetingNotesKeys.status(slug, id), data.notes);
      refresh();
    },
  });

  const regenerate = useMutation({
    mutationFn: () => send<{ notes: MeetingNotesDTO }>(`/api/meetings/${id}/notes/generate`, { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.setQueryData(meetingNotesKeys.full(slug, id), data.notes);
    },
    onSettled: refresh,
  });

  const setDone = useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      send<{ item: ActionItemDTO }>(`/api/meetings/${id}/notes/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ done }),
      }),
    onMutate: ({ itemId, done }) => {
      queryClient.setQueryData(meetingNotesKeys.full(slug, id), (prev: MeetingNotesDTO | undefined) =>
        prev ? { ...prev, actionItems: prev.actionItems.map((i) => (i.id === itemId ? { ...i, done } : i)) } : prev
      );
    },
    onSuccess: (data) => patchItem(data.item),
    onError: refresh,
  });

  const convert = useMutation({
    mutationFn: ({ itemId, kind, projectId }: { itemId: string; kind: 'follow-up' | 'project-task'; projectId?: string }) =>
      send<{ item: ActionItemDTO; created: { kind: string; id: string; title: string; projectId?: string } }>(
        `/api/meetings/${id}/notes/items/${itemId}/convert`,
        { method: 'POST', body: JSON.stringify({ kind, projectId }) }
      ),
    onSuccess: (data) => patchItem(data.item),
  });

  return { toggle, regenerate, setDone, convert, refresh };
}

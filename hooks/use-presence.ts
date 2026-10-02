'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import type { PresencePerson, PresenceSnapshot } from '@/lib/presence';

export const presenceKey = (slug: string | undefined) => ['presence', slug] as const;

const NONE: PresencePerson[] = [];

/**
 * Workspace presence: one shared heartbeat + snapshot every 30s while the tab is visible
 * (react-query pauses polling in background tabs). Every caller shares the same request.
 */
export function usePresence() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const { data: session } = useSession();
  const isStaff = !!session?.user && session.user.role !== 'CUSTOMER';

  const { data } = useQuery({
    queryKey: presenceKey(slug),
    queryFn: async (): Promise<PresenceSnapshot | null> => {
      const res = await workspaceFetch('/api/presence', { method: 'POST' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!slug && isStaff,
    refetchInterval: 30_000,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });

  return useMemo(() => {
    const me = data?.me ?? session?.user?.id ?? '';
    const online = data?.online ?? [];
    const others = (list: PresencePerson[] | undefined) =>
      list ? list.filter((p) => p.id !== me) : NONE;
    return {
      me,
      online,
      onlineIds: new Set(online.map((p) => p.id)),
      /** Teammates (not me) with this ticket open right now. */
      ticketViewers: (ticketId: string) => others(data?.tickets[ticketId]),
      /** Teammates (not me) with this doc open right now. */
      docViewers: (docId: string) => others(data?.docs[docId]),
    };
  }, [data, session?.user?.id]);
}

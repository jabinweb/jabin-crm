'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Ticket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useRealtime } from '@/hooks/use-realtime';
import { REALTIME_EVENTS } from '@/lib/realtime/events';
import { TicketSlaTimer } from '@/components/tickets/ticket-sla-timer';

type FollowUps = {
  staleTickets: Array<{
    id: string;
    subject: string;
    status: string;
    updatedAt: string;
    customer?: { organizationName?: string };
  }>;
  staleLeads: Array<{
    id: string;
    name?: string | null;
    companyName: string;
    status: string;
    updatedAt: string;
  }>;
  myOpenTickets: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    responseDueAt?: string | null;
    resolutionDueAt?: string | null;
    channel?: string;
  }>;
  nextSla: {
    id: string;
    subject: string;
    responseDueAt?: string | null;
    resolutionDueAt?: string | null;
  } | null;
  staleDays: number;
};

export function AgentQueueCard() {
  const { path, slug, workspaceFetch } = useWorkspacePaths();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['follow-ups', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/dashboard/follow-ups');
      if (!res.ok) return null;
      return res.json() as Promise<FollowUps>;
    },
    enabled: !!slug,
    staleTime: 30_000,
  });

  useRealtime({
    types: [
      REALTIME_EVENTS.TICKET_UPDATED,
      REALTIME_EVENTS.TICKET_COMMENT,
      REALTIME_EVENTS.TICKET_MOVED,
    ],
    onEvent: () => {
      void qc.invalidateQueries({ queryKey: ['follow-ups', slug] });
    },
  });

  if (isLoading || !data) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            My open tickets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.nextSla && (
            <div className="rounded-md border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-2 text-xs flex items-center justify-between gap-2">
              <span className="truncate">Next SLA: {data.nextSla.subject}</span>
              <Button asChild size="sm" variant="outline" className="h-7 shrink-0">
                <Link href={path(`/dashboard/tickets/${data.nextSla.id}`)}>Open</Link>
              </Button>
            </div>
          )}
          {!data.myOpenTickets.length ? (
            <p className="text-sm text-muted-foreground">
              No tickets assigned to you.{' '}
              <Link className="underline" href={path('/dashboard/tickets')}>
                View queue
              </Link>
            </p>
          ) : (
            data.myOpenTickets.slice(0, 6).map((t) => (
              <Link
                key={t.id}
                href={path(`/dashboard/tickets/${t.id}`)}
                className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <span className="truncate font-medium">{t.subject}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {t.channel && (
                    <Badge variant="outline" className="text-[9px]">
                      {t.channel}
                    </Badge>
                  )}
                  <TicketSlaTimer ticket={t} />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Follow-ups ({data.staleDays}d+)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!data.staleTickets.length && !data.staleLeads.length ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Nothing stale — nice work.
            </p>
          ) : (
            <>
              {data.staleTickets.slice(0, 4).map((t) => (
                <Link
                  key={t.id}
                  href={path(`/dashboard/tickets/${t.id}`)}
                  className="block text-sm truncate hover:underline"
                >
                  Ticket · {t.subject}
                  <span className="text-muted-foreground">
                    {' '}
                    · {t.customer?.organizationName || '—'}
                  </span>
                </Link>
              ))}
              {data.staleLeads.slice(0, 4).map((l) => (
                <Link
                  key={l.id}
                  href={path(`/dashboard/leads/${l.id}`)}
                  className="block text-sm truncate hover:underline"
                >
                  Lead · {l.name || l.companyName}
                </Link>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

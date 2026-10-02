'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, isToday, isTomorrow, isYesterday, startOfDay } from 'date-fns';
import { CalendarDays, Plus, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { CardListSkeleton } from '@/components/loading';
import { MeetingCard } from '@/components/meetings/meeting-card';
import { ScheduleMeetingDialog } from '@/components/meetings/schedule-meeting-dialog';
import { MeetingsNotReady, VideoSetupNotice } from '@/components/meetings/video-setup-notice';
import { MeetingApiError, useMeetingsList } from '@/hooks/use-meetings';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';
import type { MeetingDTO } from '@/lib/meetings/types';

function dayLabel(d: Date) {
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, d MMMM');
}

function groupByDay(meetings: MeetingDTO[]) {
  const groups: Array<{ key: string; label: string; items: MeetingDTO[] }> = [];
  for (const m of meetings) {
    const day = startOfDay(new Date(m.startTime));
    const key = day.toISOString();
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: dayLabel(day), items: [] };
      groups.push(g);
    }
    g.items.push(m);
  }
  return groups;
}

function MeetingsPageInner() {
  const { path } = useWorkspacePaths();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const list = useMeetingsList(tab);

  // Deep link: /meetings?new=1 opens the scheduler
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setScheduleOpen(true);
      router.replace(path('/dashboard/meetings'));
    }
  }, [path, router, searchParams]);

  const meetings = useMemo(() => list.data?.meetings ?? [], [list.data?.meetings]);
  const awaiting = tab === 'upcoming' ? meetings.filter((m) => m.myRsvp === 'PENDING' && m.status !== 'CANCELLED') : [];
  const rest = tab === 'upcoming' ? meetings.filter((m) => !awaiting.includes(m)) : meetings;
  const groups = groupByDay(rest);
  const notReady = list.error instanceof MeetingApiError && list.error.code === 'MEETINGS_NOT_READY';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Team meetings you organize or are invited to. They also show on your{' '}
            <Link href={path('/dashboard/calendar')} className="text-primary underline underline-offset-2">
              calendar
            </Link>
            .
          </p>
        </div>
        <Button onClick={() => setScheduleOpen(true)} className="self-start sm:self-auto" disabled={notReady}>
          <Plus className="h-4 w-4" />
          Schedule meeting
        </Button>
      </div>

      {list.data && !list.data.video.configured ? <VideoSetupNotice /> : null}

      <div className="flex rounded-lg border bg-muted/40 p-0.5 sm:w-fit" role="tablist" aria-label="Meetings">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors sm:flex-none',
              tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <CardListSkeleton rows={4} />
      ) : notReady ? (
        <MeetingsNotReady />
      ) : list.error ? (
        <EmptyState icon={Video} title="Couldn't load meetings" description={list.error.message} actionLabel="Try again" onAction={() => list.refetch()} />
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={tab === 'upcoming' ? Video : CalendarDays}
          title={tab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings yet'}
          description={
            tab === 'upcoming'
              ? 'Schedule a meeting with your team — everyone gets an invite, a reminder and a one-click Join.'
              : 'Meetings you attended or organized will show here.'
          }
          actionLabel={tab === 'upcoming' ? 'Schedule meeting' : undefined}
          onAction={tab === 'upcoming' ? () => setScheduleOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-6">
          {awaiting.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">
                Awaiting your reply <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{awaiting.length}</span>
              </h2>
              {awaiting.map((m) => (
                <div key={m.id} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{dayLabel(new Date(m.startTime))}</p>
                  <MeetingCard meeting={m} />
                </div>
              ))}
            </section>
          ) : null}
          {groups.map((g) => (
            <section key={g.key} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{g.label}</h2>
              {g.items.map((m) => (
                <MeetingCard key={m.id} meeting={m} />
              ))}
            </section>
          ))}
        </div>
      )}

      <ScheduleMeetingDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSaved={(m) => router.push(path(`/dashboard/meetings/${m.id}`))}
      />
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={null}>
      <MeetingsPageInner />
    </Suspense>
  );
}

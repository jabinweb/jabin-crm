'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMeetingsNow, useMeetingsRealtime } from '@/hooks/use-meetings';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';
import { startsInLabel } from '@/lib/meetings/rules';
import { MeetingPhaseBadge, phaseOf, useNow } from './meeting-status';
import { JoinButton, MeetingAvatars, RsvpControl } from './meeting-parts';

/**
 * Header indicator: appears when one of my meetings is live or starts within 15 minutes
 * (red "Live" / amber countdown, one-click Join), or when invitations await a reply.
 * Also keeps meeting views fresh via realtime.
 */
export function MeetingsIndicator() {
  useMeetingsRealtime();
  const { data } = useMeetingsNow();
  const now = useNow(15_000);
  const { path } = useWorkspacePaths();
  const [open, setOpen] = useState(false);

  const meetings = data?.meetings ?? [];
  const pending = data?.pendingInvites ?? 0;
  if (!now || (meetings.length === 0 && pending === 0)) return null;

  const live = meetings.filter((m) => phaseOf(m, now) === 'live');
  const soon = meetings.filter((m) => phaseOf(m, now) === 'soon');
  const lead = live[0] ?? soon[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {lead ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-9 gap-1.5 rounded-full px-2.5 font-semibold',
              live.length
                ? 'bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:text-red-400'
                : 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400'
            )}
            aria-label={live.length ? `${live.length} meeting live now` : `Meeting starts ${startsInLabel(lead.startTime, now)}`}
          >
            <span className="relative flex h-2 w-2">
              {live.length ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75 motion-reduce:animate-none" />
              ) : null}
              <span className={cn('relative inline-flex h-2 w-2 rounded-full', live.length ? 'bg-red-500' : 'bg-amber-500')} />
            </span>
            <Video className="h-4 w-4" />
            <span className="hidden text-xs sm:inline">
              {live.length ? 'Live' : startsInLabel(lead.startTime, now)}
            </span>
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label={`${pending} meeting invitation${pending === 1 ? '' : 's'} awaiting reply`}>
            <Video className="h-5 w-5" />
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {pending > 9 ? '9+' : pending}
            </span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Meetings</p>
          {pending > 0 ? (
            <p className="text-xs text-muted-foreground">
              {pending} invitation{pending === 1 ? '' : 's'} awaiting your reply
            </p>
          ) : null}
        </div>
        {meetings.length > 0 ? (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {meetings.map((m) => (
              <li key={m.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={path(`/dashboard/meetings/${m.id}`)}
                    onClick={() => setOpen(false)}
                    className="min-w-0 truncate text-sm font-medium hover:underline"
                  >
                    {m.title}
                  </Link>
                  <MeetingPhaseBadge meeting={m} compact />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <MeetingAvatars meeting={m} />
                  <JoinButton meeting={m} />
                </div>
                {m.myRsvp === 'PENDING' ? <RsvpControl meeting={m} /> : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-center">
            <Link href={path('/dashboard/meetings')} onClick={() => setOpen(false)}>
              All meetings
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

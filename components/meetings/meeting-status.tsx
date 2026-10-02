'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { meetingPhase, startsInLabel, type MeetingPhase } from '@/lib/meetings/rules';
import type { MeetingDTO } from '@/lib/meetings/types';

/** Current time, ticking every `ms` (countdowns, "Live now"). null until mounted (hydration-safe). */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function phaseOf(meeting: Pick<MeetingDTO, 'status' | 'startTime' | 'endTime' | 'endedAt' | 'liveCount'>, now: Date | null): MeetingPhase {
  return meetingPhase(meeting, now ?? new Date(meeting.startTime));
}

/** Pill for a meeting's state: Live now · 3 / Starting in 5 min / Upcoming / Ended / Cancelled. */
export function MeetingPhaseBadge({
  meeting,
  className,
  compact,
}: {
  meeting: Pick<MeetingDTO, 'status' | 'startTime' | 'endTime' | 'endedAt' | 'liveCount'>;
  className?: string;
  compact?: boolean;
}) {
  const now = useNow();
  if (!now) return null;
  const phase = phaseOf(meeting, now);
  const base = 'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium';
  if (phase === 'live') {
    return (
      <span className={cn(base, 'bg-red-500/10 text-red-600 dark:text-red-400', className)}>
        <span className="relative flex h-2 w-2">
          {meeting.liveCount > 0 ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75 motion-reduce:animate-none" />
          ) : null}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        {meeting.liveCount > 0
          ? compact
            ? `Live · ${meeting.liveCount}`
            : `Live now · ${meeting.liveCount} in room`
          : compact
            ? 'Now'
            : 'Happening now'}
      </span>
    );
  }
  if (phase === 'soon') {
    return (
      <span className={cn(base, 'bg-amber-500/10 text-amber-700 dark:text-amber-400', className)}>
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        {compact ? startsInLabel(meeting.startTime, now) : `Starts ${startsInLabel(meeting.startTime, now)}`}
      </span>
    );
  }
  if (phase === 'cancelled') {
    return <span className={cn(base, 'bg-muted text-muted-foreground line-through', className)}>Cancelled</span>;
  }
  if (phase === 'ended') {
    return <span className={cn(base, 'bg-muted text-muted-foreground', className)}>Ended</span>;
  }
  return compact ? null : (
    <span className={cn(base, 'bg-primary/10 text-primary', className)}>{startsInLabel(meeting.startTime, now).replace(/^in /, 'In ')}</span>
  );
}

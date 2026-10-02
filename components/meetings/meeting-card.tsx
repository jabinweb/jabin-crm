'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ExternalLink, MapPin, Repeat, Video } from 'lucide-react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';
import type { MeetingDTO } from '@/lib/meetings/types';
import { MeetingPhaseBadge } from './meeting-status';
import { JoinButton, MeetingAvatars, RsvpControl, RsvpSummaryText } from './meeting-parts';

export function ProviderIcon({ provider, className }: { provider: MeetingDTO['provider']; className?: string }) {
  const Icon = provider === 'OPSLANE' ? Video : provider === 'EXTERNAL' ? ExternalLink : MapPin;
  return <Icon className={cn('h-3.5 w-3.5 shrink-0', className)} aria-hidden />;
}

export function providerLabel(meeting: Pick<MeetingDTO, 'provider' | 'meetingLink' | 'location'>) {
  if (meeting.provider === 'OPSLANE') return 'Opslane video';
  if (meeting.provider === 'EXTERNAL') {
    try {
      return new URL(meeting.meetingLink ?? '').hostname.replace(/^www\./, '');
    } catch {
      return 'Meeting link';
    }
  }
  return meeting.location || 'In person';
}

/** One row in the Meetings list: time, title, state, guests, your reply, Join. */
export function MeetingCard({ meeting }: { meeting: MeetingDTO }) {
  const { path } = useWorkspacePaths();
  const start = new Date(meeting.startTime);
  const end = new Date(meeting.endTime);
  const cancelled = meeting.status === 'CANCELLED';
  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4 sm:p-4',
        cancelled && 'opacity-60'
      )}
    >
      <div className="flex shrink-0 items-baseline gap-2 sm:w-24 sm:flex-col sm:items-start sm:gap-0">
        <span className="text-sm font-semibold tabular-nums">{format(start, 'h:mm a')}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{format(end, 'h:mm a')}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            href={path(`/dashboard/meetings/${meeting.id}`)}
            className={cn(
              'min-w-0 truncate font-medium after:absolute after:inset-0 after:content-[""] hover:underline',
              cancelled && 'line-through'
            )}
          >
            {meeting.title}
          </Link>
          <MeetingPhaseBadge meeting={meeting} compact />
          {meeting.recurrence !== 'NONE' ? (
            <Repeat className="h-3.5 w-3.5 text-muted-foreground" aria-label="Repeating meeting" />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1">
            <ProviderIcon provider={meeting.provider} />
            <span className="truncate">{providerLabel(meeting)}</span>
          </span>
          <span className="truncate">
            {meeting.isOrganizer ? 'You organize' : `By ${meeting.organizer.name || meeting.organizer.email}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MeetingAvatars meeting={meeting} />
          <RsvpSummaryText meeting={meeting} />
        </div>
      </div>
      {/* Interactive controls sit above the stretched link */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 sm:justify-end">
        {!cancelled ? <RsvpControl meeting={meeting} /> : null}
        <JoinButton meeting={meeting} />
      </div>
    </div>
  );
}

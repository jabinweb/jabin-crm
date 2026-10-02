'use client';

import Link from 'next/link';
import { Check, CircleHelp, ExternalLink, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar, AvatarStack } from '@/components/ui/user-avatar';
import { useToast } from '@/hooks/use-toast';
import { useMeetingActions } from '@/hooks/use-meetings';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { usePresence } from '@/hooks/use-presence';
import { cn } from '@/lib/utils';
import { JOIN_EARLY_MS, JOIN_GRACE_MS, RSVP_LABEL, type Rsvp } from '@/lib/meetings/rules';
import type { MeetingAttendeeDTO, MeetingDTO } from '@/lib/meetings/types';
import { phaseOf, useNow } from './meeting-status';

const RSVP_OPTIONS: Array<{ value: Exclude<Rsvp, 'PENDING'>; label: string; icon: typeof Check }> = [
  { value: 'ACCEPTED', label: 'Going', icon: Check },
  { value: 'TENTATIVE', label: 'Maybe', icon: CircleHelp },
  { value: 'DECLINED', label: 'No', icon: X },
];

/** Accept / Maybe / Decline for an invitee. Renders nothing for the organizer or non-invitees. */
export function RsvpControl({
  meeting,
  className,
  size = 'sm',
}: {
  meeting: Pick<MeetingDTO, 'id' | 'myRsvp' | 'isOrganizer' | 'status'>;
  className?: string;
  size?: 'sm' | 'default';
}) {
  const { rsvp } = useMeetingActions();
  const { toast } = useToast();
  if (meeting.isOrganizer || !meeting.myRsvp || meeting.status === 'CANCELLED') return null;
  const pending = rsvp.isPending ? rsvp.variables?.rsvp : null;
  return (
    <div className={cn('inline-flex rounded-lg border bg-muted/40 p-0.5', className)} role="group" aria-label="Your reply">
      {RSVP_OPTIONS.map((opt) => {
        const active = (pending ?? meeting.myRsvp) === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            disabled={rsvp.isPending}
            onClick={(e) => {
              e.stopPropagation();
              if (meeting.myRsvp === opt.value) return;
              rsvp.mutate(
                { id: meeting.id, rsvp: opt.value },
                {
                  onError: (error) =>
                    toast({ title: 'Could not save your reply', description: error.message, variant: 'destructive' }),
                }
              );
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-md font-medium transition-colors disabled:opacity-60',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              active
                ? opt.value === 'DECLINED'
                  ? 'bg-background text-destructive shadow-sm'
                  : 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const RSVP_DOT: Record<Rsvp, string> = {
  ACCEPTED: 'bg-emerald-500',
  TENTATIVE: 'bg-amber-500',
  PENDING: 'bg-muted-foreground/40',
  DECLINED: 'bg-red-500',
};

export function RsvpPill({ rsvp, role }: { rsvp: Rsvp; role?: MeetingAttendeeDTO['role'] }) {
  if (role === 'ORGANIZER') {
    return <span className="text-xs font-medium text-primary">Organizer</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn('h-2 w-2 rounded-full', RSVP_DOT[rsvp])} />
      {RSVP_LABEL[rsvp]}
    </span>
  );
}

/** Avatars of the people going, with a tooltip-free "+N" overflow. */
export function MeetingAvatars({ meeting, max = 4 }: { meeting: Pick<MeetingDTO, 'attendees'>; max?: number }) {
  const going = meeting.attendees.filter((a) => a.rsvp !== 'DECLINED').map((a) => a.user);
  return <AvatarStack people={going} max={max} size="xs" />;
}

/** Guest list with RSVP state, who is in the room now, and who is online. */
export function AttendeeList({ meeting }: { meeting: MeetingDTO }) {
  const { onlineIds } = usePresence();
  return (
    <ul className="divide-y rounded-lg border">
      {meeting.attendees.map((a) => (
        <li key={a.user.id} className="flex items-center gap-3 px-3 py-2.5">
          <UserAvatar person={a.user} size="sm" online={onlineIds.has(a.user.id)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{a.user.name || a.user.email}</p>
            <RsvpPill rsvp={a.rsvp} role={a.role} />
          </div>
          {a.inRoom ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
              <Video className="h-3 w-3" /> In room
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function rsvpCounts(meeting: Pick<MeetingDTO, 'attendees'>) {
  const c = { ACCEPTED: 0, TENTATIVE: 0, PENDING: 0, DECLINED: 0 };
  for (const a of meeting.attendees) c[a.rsvp] += 1;
  return c;
}

/** "3 going · 1 maybe · 2 awaiting" */
export function RsvpSummaryText({ meeting, className }: { meeting: Pick<MeetingDTO, 'attendees'>; className?: string }) {
  const c = rsvpCounts(meeting);
  const parts = [
    `${c.ACCEPTED} going`,
    c.TENTATIVE ? `${c.TENTATIVE} maybe` : null,
    c.PENDING ? `${c.PENDING} awaiting` : null,
    c.DECLINED ? `${c.DECLINED} declined` : null,
  ].filter(Boolean);
  return <span className={cn('text-xs text-muted-foreground', className)}>{parts.join(' · ')}</span>;
}

/**
 * One-click join: Opslane room → the meeting page (straight to the camera check),
 * external → opens the link. Disabled outside the join window with the reason.
 */
export function JoinButton({
  meeting,
  size = 'sm',
  className,
  label,
}: {
  meeting: MeetingDTO;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  label?: string;
}) {
  const { path } = useWorkspacePaths();
  const now = useNow();
  if (meeting.provider === 'NONE' || meeting.status === 'CANCELLED') return null;
  const t = now?.getTime() ?? 0;
  const start = new Date(meeting.startTime).getTime();
  const end = new Date(meeting.endTime).getTime();
  const phase = phaseOf(meeting, now);
  const open = !!now && t >= start - JOIN_EARLY_MS && (t <= end + JOIN_GRACE_MS || meeting.liveCount > 0) && phase !== 'ended';
  const live = phase === 'live';
  const text = label ?? (live ? 'Join now' : 'Join');

  if (!open) {
    return (
      <Button size={size} variant="outline" disabled className={className} title="The room opens 15 minutes before the start">
        <Video className="h-4 w-4" />
        {text}
      </Button>
    );
  }
  if (meeting.provider === 'EXTERNAL' && meeting.meetingLink) {
    return (
      <Button asChild size={size} className={cn(live && 'bg-red-600 text-white hover:bg-red-600/90', className)}>
        <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          <ExternalLink className="h-4 w-4" />
          {text}
        </a>
      </Button>
    );
  }
  return (
    <Button asChild size={size} className={cn(live && 'bg-red-600 text-white hover:bg-red-600/90', className)}>
      <Link href={`${path(`/dashboard/meetings/${meeting.id}`)}?join=1`} onClick={(e) => e.stopPropagation()}>
        <Video className="h-4 w-4" />
        {text}
      </Link>
    </Button>
  );
}

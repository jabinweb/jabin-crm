'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  CalendarDays,
  CalendarX,
  Clock,
  Loader2,
  Pencil,
  Repeat,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DetailSkeleton } from '@/components/loading';
import { MeetingPhaseBadge, phaseOf, useNow } from '@/components/meetings/meeting-status';
import { AttendeeList, JoinButton, RsvpControl, RsvpSummaryText } from '@/components/meetings/meeting-parts';
import { ProviderIcon, providerLabel } from '@/components/meetings/meeting-card';
import { ScheduleMeetingDialog } from '@/components/meetings/schedule-meeting-dialog';
import { MeetingsNotReady, VideoSetupNotice } from '@/components/meetings/video-setup-notice';
import { MeetingPreJoin } from '@/components/meetings/room/prejoin';
import type { LeaveReason } from '@/components/meetings/room/meeting-room';
import { MeetingApiError, useMeeting, useMeetingActions } from '@/hooks/use-meetings';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useToast } from '@/hooks/use-toast';
import { JOIN_EARLY_MS, JOIN_GRACE_MS } from '@/lib/meetings/rules';
import type { MeetingDTO } from '@/lib/meetings/types';

// LiveKit is only downloaded when someone actually enters a room
const MeetingRoom = dynamic(() => import('@/components/meetings/room/meeting-room'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-zinc-950 text-white/70">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  ),
});

type Stage = 'details' | 'prejoin' | 'call' | 'left';

function canEnterRoom(meeting: MeetingDTO, now: Date) {
  if (meeting.provider !== 'OPSLANE' || meeting.status === 'CANCELLED') return false;
  const t = now.getTime();
  const start = new Date(meeting.startTime).getTime();
  const end = new Date(meeting.endTime).getTime();
  if (t < start - JOIN_EARLY_MS) return false;
  if (meeting.canManage) return true;
  if (meeting.endedAt && new Date(meeting.endedAt).getTime() > start) return false;
  return t <= end + JOIN_GRACE_MS || meeting.liveCount > 0;
}

function MeetingDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { path } = useWorkspacePaths();
  const { data: session } = useSession();
  const { toast } = useToast();
  const query = useMeeting(id);
  const actions = useMeetingActions();
  const now = useNow(15_000);
  const [stage, setStage] = useState<Stage>('details');
  const [leftReason, setLeftReason] = useState<LeaveReason>('left');
  const [av, setAv] = useState({ audio: true, video: true });
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const meeting = query.data?.meeting;
  const videoConfigured = !!query.data?.video.configured;

  // ?join=1 (Join buttons, notifications) goes straight to the camera check
  useEffect(() => {
    if (!meeting || !now) return;
    if (searchParams.get('join') !== '1') return;
    if (canEnterRoom(meeting, now) && videoConfigured) {
      setStage('prejoin');
    }
    router.replace(path(`/dashboard/meetings/${meeting.id}`));
  }, [meeting, now, path, router, searchParams, videoConfigured]);

  // Leaving the page or closing the tab mid-call marks you out of the room
  const leaveRef = useRef(actions.leave);
  useEffect(() => {
    leaveRef.current = actions.leave;
  }, [actions.leave]);
  useEffect(() => {
    if (stage !== 'call' || !id) return;
    const onHide = () => leaveRef.current(id);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      onHide();
    };
  }, [stage, id]);

  const onLeave = useCallback(
    (reason: LeaveReason) => {
      setLeftReason(reason);
      setStage('left');
    },
    []
  );

  const onEndForAll = useCallback(async () => {
    try {
      await actions.end.mutateAsync(id);
    } catch (error) {
      toast({ title: 'Could not end the meeting', description: (error as Error).message, variant: 'destructive' });
    }
  }, [actions.end, id, toast]);

  const header = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
      <Link href={path('/dashboard/meetings')}>
        <ArrowLeft className="h-4 w-4" />
        Meetings
      </Link>
    </Button>
  );

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <DetailSkeleton />
      </div>
    );
  }

  if (query.error || !meeting) {
    const err = query.error;
    return (
      <div className="space-y-4">
        {header}
        {err instanceof MeetingApiError && err.code === 'MEETINGS_NOT_READY' ? (
          <MeetingsNotReady />
        ) : (
          <EmptyState
            icon={CalendarX}
            title="Meeting not found"
            description="It may have been deleted, or you're not on the guest list. Ask the organizer to invite you."
            actionLabel="All meetings"
            actionHref={path('/dashboard/meetings')}
          />
        )}
      </div>
    );
  }

  const me = {
    id: session?.user?.id ?? '',
    name: session?.user?.name,
    email: session?.user?.email,
    image: session?.user?.image,
  };

  // ── In the room: full screen over the app chrome (works the same on phones) ──
  if (stage === 'call') {
    return (
      <div className="fixed inset-0 z-[60] bg-zinc-950" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <MeetingRoom meeting={meeting} initialAudio={av.audio} initialVideo={av.video} onLeave={onLeave} onEndForAll={onEndForAll} />
      </div>
    );
  }

  if (stage === 'prejoin') {
    return (
      <div className="space-y-4">
        {header}
        <MeetingPreJoin
          meeting={meeting}
          me={me}
          onJoin={(prefs) => {
            setAv(prefs);
            setStage('call');
          }}
          onCancel={() => setStage('details')}
        />
      </div>
    );
  }

  if (stage === 'left') {
    const ended = leftReason === 'ended';
    return (
      <div className="space-y-4">
        {header}
        <Card className="mx-auto max-w-md">
          <CardContent className="space-y-4 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Video className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {ended ? 'The meeting has ended' : leftReason === 'removed' ? 'You were removed from the meeting' : 'You left the meeting'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{meeting.title}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {!ended && leftReason !== 'removed' ? (
                <Button onClick={() => setStage('prejoin')}>Rejoin</Button>
              ) : null}
              <Button asChild variant="outline">
                <Link href={path('/dashboard/meetings')}>Back to meetings</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={path('/dashboard/calendar')}>Calendar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Details ──
  const start = new Date(meeting.startTime);
  const end = new Date(meeting.endTime);
  const phase = phaseOf(meeting, now);
  const cancelled = meeting.status === 'CANCELLED';
  const enter = !!now && canEnterRoom(meeting, now) && videoConfigured;

  return (
    <div className="space-y-6">
      {header}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={`min-w-0 break-words text-2xl font-bold tracking-tight sm:text-3xl ${cancelled ? 'line-through opacity-60' : ''}`}>
              {meeting.title}
            </h1>
            <MeetingPhaseBadge meeting={meeting} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {format(start, 'EEEE, d MMMM')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
            </span>
            {meeting.recurrence !== 'NONE' ? (
              <span className="inline-flex items-center gap-1.5">
                <Repeat className="h-4 w-4" />
                {meeting.recurrence === 'WEEKDAYS' ? 'Every weekday' : meeting.recurrence === 'DAILY' ? 'Daily' : 'Weekly'}
              </span>
            ) : null}
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <ProviderIcon provider={meeting.provider} className="h-4 w-4" />
              <span className="truncate">{providerLabel(meeting)}</span>
            </span>
          </div>
        </div>

        {meeting.canManage && !cancelled && phase !== 'ended' ? (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
              <CalendarX className="h-4 w-4" />
              Cancel meeting
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {/* Join panel */}
          {!cancelled && meeting.provider !== 'NONE' ? (
            <Card className={phase === 'live' ? 'border-red-500/40' : undefined}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <p className="font-medium">
                    {phase === 'live'
                      ? meeting.liveCount > 0
                        ? `${meeting.liveCount} ${meeting.liveCount === 1 ? 'person is' : 'people are'} in the room`
                        : 'The meeting is on — be the first in'
                      : phase === 'ended'
                        ? 'This meeting is over'
                        : phase === 'soon'
                          ? 'Starting soon — the room is open'
                          : 'The room opens 15 minutes before the start'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {meeting.provider === 'OPSLANE'
                      ? 'Video, audio, screen share and chat right here in Opslane.'
                      : 'Opens the meeting link in a new tab.'}
                  </p>
                </div>
                {meeting.provider === 'OPSLANE' ? (
                  enter ? (
                    <Button size="lg" className={phase === 'live' ? 'bg-red-600 text-white hover:bg-red-600/90' : undefined} onClick={() => setStage('prejoin')}>
                      <Video className="h-4 w-4" />
                      {phase === 'live' ? 'Join now' : 'Join'}
                    </Button>
                  ) : phase !== 'ended' ? (
                    <Button size="lg" variant="outline" disabled>
                      <Video className="h-4 w-4" />
                      Join
                    </Button>
                  ) : null
                ) : (
                  <JoinButton meeting={meeting} size="lg" />
                )}
              </CardContent>
            </Card>
          ) : null}

          {meeting.provider === 'OPSLANE' && !videoConfigured && !cancelled ? <VideoSetupNotice /> : null}

          {/* Your reply */}
          {meeting.myRsvp && !meeting.isOrganizer && !cancelled && phase !== 'ended' ? (
            <div className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Going?</p>
                <p className="text-sm text-muted-foreground">
                  {meeting.organizer.name || meeting.organizer.email} invited you. Your reply is shared with the organizer.
                </p>
              </div>
              <RsvpControl meeting={meeting} size="default" />
            </div>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Agenda</h2>
            {meeting.agenda ? (
              <p className="whitespace-pre-wrap break-words rounded-lg border bg-card p-4 text-sm">{meeting.agenda}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No agenda yet.</p>
            )}
          </section>
        </div>

        <aside className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Guests ({meeting.attendees.length})</h2>
            <RsvpSummaryText meeting={meeting} />
          </div>
          <AttendeeList meeting={meeting} />
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href={`${path('/dashboard/calendar')}?date=${encodeURIComponent(meeting.startTime)}`}>
              <CalendarDays className="h-4 w-4" />
              Show in calendar
            </Link>
          </Button>
        </aside>
      </div>

      <ScheduleMeetingDialog open={editOpen} onOpenChange={setEditOpen} meeting={meeting} />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel “{meeting.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Guests are notified and it stays on calendars as cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            {meeting.seriesId ? (
              <AlertDialogAction
                className="bg-background text-destructive border border-input hover:bg-accent"
                onClick={() => cancel(true)}
              >
                This and following
              </AlertDialogAction>
            ) : null}
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => cancel(false)}>
              {meeting.seriesId ? 'Only this one' : 'Cancel meeting'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  function cancel(series: boolean) {
    actions.cancel.mutate(
      { id: meeting!.id, series },
      {
        onSuccess: (data) =>
          toast({
            title: data.cancelled > 1 ? `${data.cancelled} meetings cancelled` : 'Meeting cancelled',
            description: 'Guests were notified.',
          }),
        onError: (error) => toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' }),
      }
    );
  }
}

export default function MeetingPage() {
  return (
    <Suspense fallback={null}>
      <MeetingDetail />
    </Suspense>
  );
}

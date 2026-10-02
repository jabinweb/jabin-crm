'use client';

import { useState } from 'react';
import { Check, CircleHelp, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMeetingActions } from '@/hooks/use-meetings';
import { useToast } from '@/hooks/use-toast';
import { RSVP_LABEL, type Rsvp } from '@/lib/meetings/rules';
import type { Notification } from '@/types/notifications';

/**
 * Inline actions on meeting notifications in the bell panel:
 * reply to an invitation without leaving the page, or jump straight into the room.
 */
export function MeetingNotificationActions({
  notification,
  onNavigate,
}: {
  notification: Notification;
  onNavigate: (href: string) => void;
}) {
  const { rsvp } = useMeetingActions();
  const { toast } = useToast();
  const [replied, setReplied] = useState<Rsvp | null>(null);
  const meetingId = typeof notification.metadata?.meetingId === 'string' ? notification.metadata.meetingId : null;
  const actions: string[] = Array.isArray(notification.metadata?.actions) ? notification.metadata.actions : [];
  if (!meetingId || actions.length === 0) return null;

  const reply = (value: Exclude<Rsvp, 'PENDING'>) =>
    rsvp.mutate(
      { id: meetingId, rsvp: value },
      {
        onSuccess: () => setReplied(value),
        onError: (error) => toast({ title: 'Could not save your reply', description: error.message, variant: 'destructive' }),
      }
    );

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {actions.includes('join') ? (
        <Button size="sm" className="h-7 bg-red-600 px-2.5 text-white hover:bg-red-600/90" onClick={() => onNavigate(`/dashboard/meetings/${meetingId}?join=1`)}>
          <Video className="h-3.5 w-3.5" />
          Join
        </Button>
      ) : null}
      {actions.includes('rsvp') ? (
        replied ? (
          <span className="text-xs font-medium text-muted-foreground">Replied: {RSVP_LABEL[replied]}</span>
        ) : (
          <>
            <Button size="sm" variant="outline" className="h-7 px-2.5" disabled={rsvp.isPending} onClick={() => reply('ACCEPTED')}>
              <Check className="h-3.5 w-3.5" />
              Going
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2.5" disabled={rsvp.isPending} onClick={() => reply('TENTATIVE')}>
              <CircleHelp className="h-3.5 w-3.5" />
              Maybe
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2.5" disabled={rsvp.isPending} onClick={() => reply('DECLINED')}>
              <X className="h-3.5 w-3.5" />
              No
            </Button>
          </>
        )
      ) : null}
    </div>
  );
}

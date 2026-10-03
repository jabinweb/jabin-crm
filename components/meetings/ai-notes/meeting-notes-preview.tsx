'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMeetingNotesPreview } from '@/hooks/use-meeting-notes';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import type { MeetingDTO } from '@/lib/meetings/types';

/**
 * Compact AI-notes teaser for the calendar event sheet: the first lines of the summary and
 * open action items, linking to the full notes. Renders nothing when there are no notes.
 */
export function MeetingNotesPreview({ meeting }: { meeting: Pick<MeetingDTO, 'id' | 'provider' | 'status' | 'startTime'> }) {
  const { path } = useWorkspacePaths();
  // Notes only exist once a meeting has started
  const enabled =
    meeting.provider === 'OPSLANE' && meeting.status !== 'CANCELLED' && new Date(meeting.startTime).getTime() <= Date.now();
  const { data: notes, isLoading } = useMeetingNotesPreview(meeting.id, enabled);
  if (!enabled) return null;
  const href = `${path(`/dashboard/meetings/${meeting.id}`)}#ai-notes`;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-violet-500" />
          AI notes
        </p>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (!notes) return null;
  const open = notes.actionItems.filter((i) => !i.done).length;
  const has = !!notes.summary || notes.actionItems.length > 0;
  if (!has && !notes.enabled && !notes.generating) return null;

  return (
    <div className="space-y-1.5">
      <p className="inline-flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-violet-500" />
        AI notes
      </p>
      {notes.summary ? (
        <p className="line-clamp-3 break-words text-sm text-muted-foreground">{notes.summary}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {notes.enabled ? 'Capturing the conversation now.' : 'Writing the summary…'}
        </p>
      )}
      <Link href={href} className="inline-block text-sm text-primary hover:underline">
        {has ? `View notes${open ? ` · ${open} open action item${open === 1 ? '' : 's'}` : ''}` : 'Open meeting'}
      </Link>
    </div>
  );
}

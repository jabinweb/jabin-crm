'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronDown, DatabaseZap, Video } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

/** Shown until the team-meetings migration is applied (API answers 503 MEETINGS_NOT_READY). */
export function MeetingsNotReady() {
  return (
    <EmptyState
      icon={DatabaseZap}
      title="Team meetings need a quick database update"
      description="An admin has to apply the team-meetings migration (20261003120000_team_meetings) before meetings can be scheduled. Your calendar keeps working meanwhile."
    />
  );
}

/**
 * Shown when built-in video (LiveKit) isn't configured. Everyone sees that meetings use
 * links for now; admins get the setup steps.
 */
export function VideoSetupNotice({ className }: { className?: string }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('rounded-lg border border-dashed bg-muted/30 p-3 text-sm sm:p-4', className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-background p-1.5 text-muted-foreground shadow-sm">
          <Video className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Built-in video rooms are off</p>
          <p className="mt-0.5 text-muted-foreground">
            Meetings still go on everyone&apos;s calendar with invites and reminders — add a Google Meet or Zoom link to each.
            {isAdmin ? ' Turn on Opslane video to meet without leaving the app.' : ' Ask a workspace admin to turn on Opslane video.'}
          </p>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
              aria-expanded={open}
            >
              How to set it up
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            </button>
          ) : null}
          {isAdmin && open ? (
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <p>
                Opslane video runs on <span className="font-medium text-foreground">LiveKit</span>. Use LiveKit Cloud (free tier,
                no servers) or self-host it with Docker, then add these environment variables and redeploy:
              </p>
              <pre className="overflow-x-auto rounded-md bg-background p-2 font-mono text-[11px] leading-relaxed text-foreground">
{`LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=<api key>
LIVEKIT_API_SECRET=<api secret>`}
              </pre>
              <p>
                Optional: point a LiveKit webhook at <code className="font-mono">/api/webhooks/livekit</code> so “who’s in the
                room” is always exact.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

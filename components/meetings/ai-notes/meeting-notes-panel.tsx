'use client';

/**
 * "AI notes" on the meeting page: summary, key points, action-item checklist (owner, due,
 * → follow-up / project task), collapsible speaker-labelled transcript, Regenerate and Copy.
 * Headings render immediately; only fetched content shows skeletons.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  FolderKanban,
  ListChecks,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MeetingApiError } from '@/hooks/use-meetings';
import { useMeetingNotes, useMeetingNotesActions } from '@/hooks/use-meeting-notes';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import type { ActionItemDTO, MeetingNotesDTO, TranscriptLineDTO } from '@/lib/meetings/ai-notes/types';
import type { MeetingDTO } from '@/lib/meetings/types';
import { cn } from '@/lib/utils';

export function MeetingNotesPanel({ meeting }: { meeting: MeetingDTO }) {
  const query = useMeetingNotes(meeting.id);
  const actions = useMeetingNotesActions(meeting.id);
  const notes = query.data;
  const hasContent = !!notes && (!!notes.summary || notes.keyPoints.length > 0 || notes.actionItems.length > 0);

  const regenerate = () =>
    actions.regenerate.mutate(undefined, {
      onSuccess: () => toast.success('Notes updated'),
      onError: (error) => toast.error('Could not write notes', { description: error.message }),
    });

  const copy = async () => {
    if (!notes) return;
    try {
      await navigator.clipboard.writeText(notesToText(meeting, notes));
      toast.success('Notes copied');
    } catch {
      toast.error('Could not copy — your browser blocked clipboard access');
    }
  };

  const generating = !!notes?.generating || actions.regenerate.isPending;

  return (
    <section id="ai-notes" className="scroll-mt-20 space-y-3" aria-labelledby="ai-notes-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ai-notes-heading" className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-violet-500" />
          AI notes
          {notes?.enabled ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
              Capturing
            </span>
          ) : null}
        </h2>
        {notes ? (
          <div className="flex items-center gap-1">
            {hasContent ? (
              <Button variant="ghost" size="sm" onClick={copy}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            ) : null}
            {notes.canControl && notes.segmentCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={regenerate} disabled={generating}>
                <RefreshCw className={cn('h-4 w-4', generating && 'animate-spin')} />
                {hasContent ? 'Regenerate' : 'Write notes'}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {query.isLoading ? (
        <NotesSkeleton />
      ) : query.error || !notes ? (
        <NotesError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <NotesBody meeting={meeting} notes={notes} generating={generating} hasContent={hasContent} onRegenerate={regenerate} />
      )}
    </section>
  );
}

function NotesSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4" aria-busy="true" aria-label="Loading AI notes">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}

function NotesError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const notReady = error instanceof MeetingApiError && error.code === 'NOTES_NOT_READY';
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        {notReady
          ? 'AI notes need a one-time database update before they can be used in this workspace.'
          : 'Could not load AI notes.'}
      </p>
      {!notReady ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

function NotesBody({
  meeting,
  notes,
  generating,
  hasContent,
  onRegenerate,
}: {
  meeting: MeetingDTO;
  notes: MeetingNotesDTO;
  generating: boolean;
  hasContent: boolean;
  onRegenerate: () => void;
}) {
  // Nothing captured yet
  if (!hasContent && notes.segmentCount === 0 && !generating) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {meeting.provider !== 'OPSLANE'
          ? 'AI notes work in Opslane video meetings.'
          : notes.enabled
            ? 'AI notes are on. The transcript appears here as people talk, and the summary when the meeting ends.'
            : notes.canControl
              ? 'Turn on AI notes from the top bar during the call. A summary and action items appear here when the meeting ends.'
              : 'No AI notes for this meeting. The organizer can turn them on during the call.'}
        {notes.canControl && notes.aiConfigured === false && meeting.provider === 'OPSLANE' ? (
          <span className="mt-2 block text-amber-600 dark:text-amber-400">
            AI isn&apos;t set up yet — add a Gemini API key in Settings → Integrations first.
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      {notes.error && !generating ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-start gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {notes.error}
          </p>
          {notes.canControl ? (
            <Button size="sm" variant="outline" onClick={onRegenerate}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      {generating && !hasContent ? (
        <div className="space-y-2" aria-busy="true">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Writing the summary and action items…
          </p>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : null}

      {!hasContent && !generating && notes.segmentCount > 0 && !notes.error ? (
        <p className="text-sm text-muted-foreground">
          {notes.enabled || !notes.meetingOver
            ? 'Capturing the conversation — the summary is written when the meeting ends.'
            : 'The transcript is ready. The summary will appear shortly.'}
        </p>
      ) : null}

      {notes.summary ? (
        <div className="space-y-1">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</h3>
          <p className={cn('whitespace-pre-wrap break-words text-sm leading-relaxed', generating && 'opacity-60')}>{notes.summary}</p>
        </div>
      ) : null}

      {notes.keyPoints.length ? (
        <div className="space-y-1">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Key points</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {notes.keyPoints.map((p, i) => (
              <li key={i} className="break-words">
                {p}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasContent ? (
        <div className="space-y-1.5">
          <h3 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" />
            Action items
          </h3>
          {notes.actionItems.length ? (
            <ul className="divide-y rounded-md border">
              {notes.actionItems.map((item) => (
                <ActionItemRow key={item.id} meetingId={meeting.id} item={item} canEdit={notes.canEdit} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No action items were mentioned.</p>
          )}
        </div>
      ) : null}

      {notes.generatedAt ? (
        <p className="text-xs text-muted-foreground">
          Written by AI {format(new Date(notes.generatedAt), 'd MMM, h:mm a')} · check important details against the transcript.
        </p>
      ) : null}

      <TranscriptSection lines={notes.transcript ?? []} count={notes.segmentCount} />
    </div>
  );
}

function ActionItemRow({ meetingId, item, canEdit }: { meetingId: string; item: ActionItemDTO; canEdit: boolean }) {
  const actions = useMeetingNotesActions(meetingId);
  const { path } = useWorkspacePaths();
  const [projectOpen, setProjectOpen] = useState(false);
  const converting = actions.convert.isPending && actions.convert.variables?.itemId === item.id;
  const ownerLabel = item.owner ? item.owner.name || item.owner.email : item.ownerName;

  const toFollowUp = () =>
    actions.convert.mutate(
      { itemId: item.id, kind: 'follow-up' },
      {
        onSuccess: () => toast.success('Follow-up created', { description: ownerLabel ? `Assigned to ${ownerLabel}.` : undefined }),
        onError: (error) => toast.error('Could not create the follow-up', { description: error.message }),
      }
    );

  return (
    <li className="flex items-start gap-3 p-3">
      <Checkbox
        className="mt-0.5"
        checked={!!item.done}
        disabled={!canEdit}
        aria-label={item.done ? 'Mark as not done' : 'Mark as done'}
        onCheckedChange={(v) =>
          actions.setDone.mutate(
            { itemId: item.id, done: v === true },
            { onError: (error) => toast.error('Could not update the item', { description: error.message }) }
          )
        }
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn('break-words text-sm', item.done && 'text-muted-foreground line-through')}>{item.text}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {ownerLabel ? (
            <span className="inline-flex items-center gap-1.5">
              {item.owner ? <UserAvatar person={item.owner} size="xs" /> : null}
              {ownerLabel}
            </span>
          ) : (
            <span>No owner</span>
          )}
          {item.dueDate ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              Due {format(new Date(`${item.dueDate}T12:00:00`), 'd MMM')}
            </span>
          ) : null}
          {item.followUpId ? (
            <Link href={path('/dashboard/tasks')} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Check className="h-3.5 w-3.5" />
              Follow-up created
            </Link>
          ) : null}
          {item.taskId && item.projectId ? (
            <Link
              href={path(`/dashboard/projects/${item.projectId}/tasks/${item.taskId}`)}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Check className="h-3.5 w-3.5" />
              Project task
            </Link>
          ) : null}
        </div>
      </div>
      {canEdit && !item.followUpId && !item.taskId ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2" disabled={converting} aria-label="Create follow-up or task">
              {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
              <span className="hidden sm:inline">Create</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={toFollowUp}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Create follow-up
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setProjectOpen(true)}>
              <FolderKanban className="mr-2 h-4 w-4" />
              Create project task…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {projectOpen ? (
        <ProjectTaskDialog
          open={projectOpen}
          onOpenChange={setProjectOpen}
          item={item}
          ownerLabel={ownerLabel ?? null}
          pending={converting}
          onCreate={(projectId) =>
            actions.convert.mutate(
              { itemId: item.id, kind: 'project-task', projectId },
              {
                onSuccess: () => {
                  setProjectOpen(false);
                  toast.success('Project task created', { description: ownerLabel ? `Assigned to ${ownerLabel}.` : undefined });
                },
                onError: (error) => toast.error('Could not create the task', { description: error.message }),
              }
            )
          }
        />
      ) : null}
    </li>
  );
}

type ProjectOption = { id: string; name: string; status?: string };

function ProjectTaskDialog({
  open,
  onOpenChange,
  item,
  ownerLabel,
  pending,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ActionItemDTO;
  ownerLabel: string | null;
  pending: boolean;
  onCreate: (projectId: string) => void;
}) {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const [projectId, setProjectId] = useState('');
  const projects = useQuery({
    queryKey: ['projects', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      return (await res.json()) as ProjectOption[];
    },
    enabled: open && !!slug,
    staleTime: 60_000,
  });
  const active = useMemo(
    () => (projects.data ?? []).filter((p) => !p.status || p.status === 'ACTIVE' || p.status === 'ON_HOLD'),
    [projects.data]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create project task</DialogTitle>
          <DialogDescription className="break-words">
            “{item.text}”{ownerLabel ? ` — assigned to ${ownerLabel}` : ''}
            {item.dueDate ? `, due ${format(new Date(`${item.dueDate}T12:00:00`), 'd MMM')}` : ''}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`project-${item.id}`}>Project</Label>
          {projects.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : projects.error ? (
            <p className="text-sm text-destructive">Could not load projects.</p>
          ) : active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active projects in this workspace.</p>
          ) : (
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id={`project-${item.id}`}>
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {active.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onCreate(projectId)} disabled={!projectId || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TranscriptSection({ lines, count }: { lines: TranscriptLineDTO[]; count: number }) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  const origin = lines.length ? new Date(lines[0].startedAt).getTime() : 0;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-3">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
          {open ? 'Hide transcript' : `Show transcript (${count} ${count === 1 ? 'part' : 'parts'})`}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-2 max-h-[28rem] space-y-2 overflow-y-auto pr-1 text-sm">
          {lines.map((line) => (
            <li key={line.id} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2">
              <span className="pt-0.5 text-xs tabular-nums text-muted-foreground">{elapsed(new Date(line.startedAt).getTime() - origin)}</span>
              <p className="break-words">
                <span className="font-medium">{line.speakerName}: </span>
                {line.text}
              </p>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function elapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

/** Plain-text export for Copy (paste into chat, email, docs). */
export function notesToText(meeting: Pick<MeetingDTO, 'title' | 'startTime'>, notes: MeetingNotesDTO) {
  const out: string[] = [`${meeting.title} — ${format(new Date(meeting.startTime), 'EEE d MMM yyyy, h:mm a')}`];
  if (notes.summary) out.push('', 'Summary', notes.summary);
  if (notes.keyPoints.length) out.push('', 'Key points', ...notes.keyPoints.map((p) => `• ${p}`));
  if (notes.actionItems.length) {
    out.push(
      '',
      'Action items',
      ...notes.actionItems.map((i) => {
        const owner = i.owner?.name || i.owner?.email || i.ownerName;
        const meta = [owner, i.dueDate ? `due ${i.dueDate}` : null].filter(Boolean).join(', ');
        return `${i.done ? '[x]' : '[ ]'} ${i.text}${meta ? ` (${meta})` : ''}`;
      })
    );
  }
  return out.join('\n');
}

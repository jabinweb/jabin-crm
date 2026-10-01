'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  FileText,
  ListChecks,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
  TextQuote,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';
import type { MentionUser } from '@/components/ui/rich-text-editor';

const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((mod) => mod.RichTextEditor),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

type Person = { id: string; name: string | null; email: string | null; image?: string | null };

export type ProjectDocDetail = {
  id: string;
  projectId: string;
  parentId: string | null;
  kind: 'FOLDER' | 'PAGE';
  title: string;
  icon: string | null;
  contentHtml: string | null;
  updatedAt: string;
  updatedById: string | null;
  createdBy?: Person | null;
  updatedBy?: Person | null;
};

type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict';
type AiAction = 'draft' | 'continue' | 'improve' | 'summarize' | 'action_items';

const AUTOSAVE_DELAY_MS = 1000;
const HEARTBEAT_MS = 12_000;

const DOC_ICONS = [
  '📄', '📝', '📌', '📎', '📚', '📊', '📈', '🗂️',
  '🧭', '🎯', '🚀', '💡', '🔧', '🔒', '🧪', '🎨',
  '🗓️', '✅', '⚠️', '💬', '🤝', '💰', '🌐', '⭐',
];

function initials(person: { name?: string | null; email?: string | null }) {
  return (person.name || person.email || '?').trim().slice(0, 2).toUpperCase();
}

function sameInstant(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return a === b;
  return new Date(a).getTime() === new Date(b).getTime();
}

function formatEdited(value: string) {
  const date = new Date(value);
  const diffMin = Math.round((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffMin < 24 * 60) return `${Math.round(diffMin / 60)} h ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * One open project doc: title, icon, body with autosave, who-else-is-here presence,
 * live pull of other people's saves, and the AI writing assistant.
 * Mount with `key={docId}` so switching docs resets all local state.
 */
export function ProjectDocEditor({
  projectId,
  docId,
  canWrite,
  currentUserId,
  mentionUsers,
  remoteTick,
  onMetaChange,
}: {
  projectId: string;
  docId: string;
  canWrite: boolean;
  currentUserId?: string;
  mentionUsers?: MentionUser[];
  /** Bumped by the parent when a realtime event says someone else touched this doc */
  remoteTick: number;
  /** Lets the tree reflect title / icon edits without waiting for a refetch */
  onMetaChange: (docId: string, patch: { title?: string; icon?: string | null }) => void;
}) {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const docUrl = `/api/projects/${projectId}/docs/${docId}`;

  const { data: doc, isLoading, isError } = useQuery({
    queryKey: ['project-doc', slug, projectId, docId],
    queryFn: async () => {
      const res = await workspaceFetch(docUrl);
      if (!res.ok) throw new Error('Failed to load doc');
      return (await res.json()) as ProjectDocDetail;
    },
    enabled: !!slug,
    // Local state is the source of truth while the doc is open
    staleTime: Infinity,
    gcTime: 0,
  });

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [edited, setEdited] = useState<{ at: string; by: Person | null } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [remoteChange, setRemoteChange] = useState(false);
  const [viewers, setViewers] = useState<Person[]>([]);
  const [iconOpen, setIconOpen] = useState(false);

  const loadedRef = useRef(false);
  const baseRef = useRef<string | null>(null);
  const latestRef = useRef({ title: '', content: '' });
  const dirtyRef = useRef({ title: false, content: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlightRef = useRef(false);

  const applyDoc = useCallback((next: ProjectDocDetail) => {
    latestRef.current = { title: next.title, content: next.contentHtml ?? '' };
    dirtyRef.current = { title: false, content: false };
    baseRef.current = next.updatedAt;
    setTitle(next.title);
    setContent(next.contentHtml ?? '');
    setIcon(next.icon);
    setEdited({ at: next.updatedAt, by: next.updatedBy ?? null });
    setRemoteChange(false);
    setSaveState('idle');
  }, []);

  useEffect(() => {
    if (!doc || loadedRef.current) return;
    loadedRef.current = true;
    applyDoc(doc);
  }, [doc, applyDoc]);

  const save = useCallback(
    async (opts?: { overwrite?: boolean }) => {
      if (!canWrite || !loadedRef.current) return;
      if (inFlightRef.current) return; // the running save re-checks dirty state when it finishes
      const dirty = dirtyRef.current;
      if (!dirty.title && !dirty.content) return;

      const payload: Record<string, unknown> = {};
      if (dirty.title) payload.title = latestRef.current.title;
      if (dirty.content) {
        payload.contentHtml = latestRef.current.content;
        if (!opts?.overwrite) payload.baseUpdatedAt = baseRef.current;
      }
      dirtyRef.current = { title: false, content: false };
      inFlightRef.current = true;
      setSaveState('saving');

      let failed: SaveState | null = null;
      try {
        const res = await workspaceFetch(docUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        if (res.status === 409) failed = 'conflict';
        else if (!res.ok) failed = 'error';
        else {
          const saved = (await res.json()) as ProjectDocDetail;
          baseRef.current = saved.updatedAt;
          setEdited({ at: saved.updatedAt, by: saved.updatedBy ?? null });
          setRemoteChange(false);
        }
      } catch {
        failed = 'error';
      } finally {
        inFlightRef.current = false;
      }

      if (failed) {
        // Nothing was written — keep the edits queued
        dirtyRef.current = {
          title: dirtyRef.current.title || dirty.title,
          content: dirtyRef.current.content || dirty.content,
        };
        setSaveState(failed);
        return;
      }

      if (dirtyRef.current.title || dirtyRef.current.content) {
        void save(); // edits made while this save was in flight
      } else {
        setSaveState('saved');
      }
    },
    [canWrite, docUrl, workspaceFetch]
  );

  const scheduleSave = useCallback(() => {
    setSaveState((prev) => (prev === 'conflict' ? prev : 'unsaved'));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
  }, [save]);

  const reloadRemote = useCallback(async () => {
    const res = await workspaceFetch(docUrl);
    if (!res.ok) return;
    const next = (await res.json()) as ProjectDocDetail;
    if (timerRef.current) clearTimeout(timerRef.current);
    applyDoc(next);
    onMetaChange(docId, { title: next.title, icon: next.icon });
  }, [applyDoc, docId, docUrl, onMetaChange, workspaceFetch]);

  // Presence heartbeat — also how remote saves are noticed
  const heartbeat = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const res = await workspaceFetch(`${docUrl}/presence`, { method: 'POST' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        viewers: Person[];
        updatedAt: string;
        updatedById: string | null;
      };
      setViewers(data.viewers);
      if (!loadedRef.current || inFlightRef.current) return;
      if (sameInstant(data.updatedAt, baseRef.current)) return;
      if (!dirtyRef.current.title && !dirtyRef.current.content) {
        void reloadRemote();
      } else if (data.updatedById === currentUserId) {
        baseRef.current = data.updatedAt; // our own save from another tab / the tree rename
      } else {
        setRemoteChange(true);
      }
    } catch {
      /* offline — next beat retries */
    }
  }, [currentUserId, docUrl, reloadRemote, workspaceFetch]);

  useEffect(() => {
    void heartbeat();
    const interval = setInterval(() => void heartbeat(), HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [heartbeat]);

  useEffect(() => {
    if (remoteTick > 0) void heartbeat();
  }, [remoteTick, heartbeat]);

  // Leaving the doc: flush pending edits and drop presence
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    const flush = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void saveRef.current();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
      void workspaceFetch(`${docUrl}/presence`, { method: 'DELETE', keepalive: true }).catch(
        () => undefined
      );
      void queryClient.invalidateQueries({ queryKey: ['project-docs', slug, projectId] });
    };
  }, [docUrl, projectId, queryClient, slug, workspaceFetch]);

  const changeIcon = async (next: string | null) => {
    setIconOpen(false);
    const previous = icon;
    setIcon(next);
    onMetaChange(docId, { icon: next });
    const res = await workspaceFetch(docUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icon: next }),
    });
    if (!res.ok) {
      setIcon(previous);
      onMetaChange(docId, { icon: previous });
      toast.error('Could not update the icon');
    }
  };

  // ── AI assistant ───────────────────────────────────────────────────────────
  const [aiBusy, setAiBusy] = useState<AiAction | null>(null);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState<{ action: AiAction; html: string } | null>(null);

  const runAi = async (action: AiAction, prompt?: string) => {
    setAiBusy(action);
    try {
      const res = await workspaceFetch(`/api/projects/${projectId}/docs/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          prompt,
          title: latestRef.current.title,
          contentHtml: latestRef.current.content,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The assistant failed');
      setAiPromptOpen(false);
      setAiPrompt('');
      setAiResult({ action, html: data.html as string });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The assistant failed');
    } finally {
      setAiBusy(null);
    }
  };

  const applyAi = (mode: 'append' | 'replace') => {
    if (!aiResult) return;
    const next = mode === 'replace' ? aiResult.html : `${latestRef.current.content}${aiResult.html}`;
    latestRef.current.content = next;
    dirtyRef.current.content = true;
    setContent(next);
    scheduleSave();
    setAiResult(null);
  };

  if (isLoading || (!doc && !isError)) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <EmptyState
        icon={FileText}
        title="Doc not found"
        description="It may have been deleted or moved to another project."
      />
    );
  }

  const aiMenu = canWrite ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-primary"
          disabled={!!aiBusy}
        >
          {aiBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">AI assist</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Write</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setAiPromptOpen(true)}>
          <PenLine className="mr-2 h-4 w-4" />
          Draft from a prompt…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void runAi('continue')}>
          <Wand2 className="mr-2 h-4 w-4" />
          Continue writing
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void runAi('improve')}>
          <Sparkles className="mr-2 h-4 w-4" />
          Improve writing
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Understand</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void runAi('summarize')}>
          <TextQuote className="mr-2 h-4 w-4" />
          Summarize
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void runAi('action_items')}>
          <ListChecks className="mr-2 h-4 w-4" />
          Extract action items
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header: icon, title, presence, save status */}
      <div className="shrink-0 space-y-2 px-4 pt-5 sm:px-8">
        <div className="flex items-start gap-3">
          <Popover open={iconOpen} onOpenChange={setIconOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={!canWrite}
                aria-label="Change icon"
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-2xl hover:bg-muted disabled:hover:bg-transparent"
              >
                {icon || <FileText className="h-6 w-6 text-muted-foreground" />}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="grid grid-cols-8 gap-1">
                {DOC_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => void changeIcon(emoji)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded text-base hover:bg-muted',
                      icon === emoji && 'bg-muted'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {icon ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 w-full text-xs"
                  onClick={() => void changeIcon(null)}
                >
                  Remove icon
                </Button>
              ) : null}
            </PopoverContent>
          </Popover>

          <input
            value={title}
            readOnly={!canWrite}
            onChange={(e) => {
              const next = e.target.value;
              setTitle(next);
              latestRef.current.title = next;
              dirtyRef.current.title = true;
              onMetaChange(docId, { title: next.trim() || 'Untitled' });
              scheduleSave();
            }}
            placeholder="Untitled"
            aria-label="Doc title"
            className="min-w-0 flex-1 bg-transparent py-1 text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/60 md:text-3xl"
          />

          {viewers.length > 0 ? (
            <div
              className="mt-1.5 flex shrink-0 items-center -space-x-2"
              title={`Also viewing: ${viewers.map((v) => v.name || v.email).join(', ')}`}
            >
              {viewers.slice(0, 4).map((viewer) => (
                <Avatar key={viewer.id} className="h-7 w-7 border-2 border-background">
                  <AvatarImage src={viewer.image || undefined} />
                  <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                    {initials(viewer)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {viewers.length > 4 ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                  +{viewers.length - 4}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[52px] text-xs text-muted-foreground">
          {edited ? (
            <span>
              Edited {formatEdited(edited.at)}
              {edited.by ? ` by ${edited.by.name || edited.by.email}` : ''}
            </span>
          ) : null}
          {canWrite ? (
            <span
              className={cn(
                'inline-flex items-center gap-1',
                (saveState === 'error' || saveState === 'conflict') && 'text-destructive'
              )}
              aria-live="polite"
            >
              {saveState === 'saving' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                </>
              ) : saveState === 'saved' ? (
                <>
                  <Check className="h-3 w-3" /> Saved
                </>
              ) : saveState === 'unsaved' ? (
                'Unsaved changes'
              ) : saveState === 'error' ? (
                <>
                  Couldn’t save.
                  <button type="button" className="underline" onClick={() => void save()}>
                    Retry
                  </button>
                </>
              ) : saveState === 'conflict' ? (
                'Not saved — someone else changed this doc'
              ) : null}
            </span>
          ) : (
            <span>View only</span>
          )}
        </div>

        {saveState === 'conflict' || remoteChange ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="min-w-0 flex-1">
              A teammate saved a newer version of this doc while you were editing.
            </span>
            <Button size="sm" variant="outline" className="h-7" onClick={() => void reloadRemote()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Load theirs
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                setRemoteChange(false);
                void save({ overwrite: true });
              }}
            >
              Keep mine
            </Button>
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-10 pt-3 sm:px-5">
        <RichTextEditor
          content={content}
          onChange={(html) => {
            if (html === latestRef.current.content) return;
            setContent(html);
            latestRef.current.content = html;
            dirtyRef.current.content = true;
            scheduleSave();
          }}
          editable={canWrite}
          placeholder="Start writing, or type @ to mention a teammate…"
          minHeightClass="min-h-[320px]"
          folder="project-docs"
          mentionUsers={mentionUsers}
          blockFormatting
          borderless
          toolbarEnd={aiMenu}
        />
      </div>

      {/* AI: prompt for a draft */}
      <Dialog open={aiPromptOpen} onOpenChange={setAiPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Draft with AI</DialogTitle>
            <DialogDescription>
              Describe what you need. You’ll review the draft before it goes into the doc.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g. A launch checklist for the client website, grouped by QA, content and DNS"
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiPromptOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!aiPrompt.trim() || aiBusy === 'draft'}
              onClick={() => void runAi('draft', aiPrompt.trim())}
            >
              {aiBusy === 'draft' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI: review the result */}
      <Dialog open={!!aiResult} onOpenChange={(open) => !open && setAiResult(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI suggestion</DialogTitle>
            <DialogDescription>
              Review before adding it — AI output can be wrong.
            </DialogDescription>
          </DialogHeader>
          {aiResult ? (
            <div
              className="rich-text-content max-h-[50vh] overflow-y-auto rounded-md border bg-muted/30 p-4 text-sm leading-relaxed"
              // Sanitized server-side (lib/html/sanitize-rich-text.ts)
              dangerouslySetInnerHTML={{ __html: aiResult.html }}
            />
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setAiResult(null)}>
              Discard
            </Button>
            {aiResult?.action === 'improve' ? (
              <Button variant="outline" onClick={() => applyAi('replace')}>
                Replace doc
              </Button>
            ) : null}
            <Button onClick={() => applyAi('append')}>Add to end of doc</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

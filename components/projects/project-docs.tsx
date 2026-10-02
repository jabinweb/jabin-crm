'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePresence } from '@/hooks/use-presence';
import { LiveViewers } from '@/components/presence/live-viewers';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CornerUpLeft,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useRealtime } from '@/hooks/use-realtime';
import { REALTIME_EVENTS } from '@/lib/realtime/events';
import { confirmAction } from '@/lib/confirm-action';
import { cn } from '@/lib/utils';
import type { MentionUser } from '@/components/ui/rich-text-editor';
import { ProjectDocEditor } from '@/components/projects/project-doc-editor';

type DocKind = 'FOLDER' | 'PAGE';

type DocNode = {
  id: string;
  parentId: string | null;
  kind: DocKind;
  title: string;
  icon: string | null;
  sortOrder: number;
  updatedAt: string;
};

type DocsResponse = {
  project: { id: string; name: string };
  docs: DocNode[];
  canWrite: boolean;
};

const ROOT = '__root__';

function childrenIndex(docs: DocNode[]) {
  const map = new Map<string, DocNode[]>();
  for (const doc of docs) {
    const key = doc.parentId ?? ROOT;
    const list = map.get(key);
    if (list) list.push(doc);
    else map.set(key, [doc]);
  }
  map.forEach((list) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  });
  return map;
}

/** Ids of `id` and everything nested under it. */
function subtreeIds(index: Map<string, DocNode[]>, id: string): Set<string> {
  const ids = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    for (const child of index.get(stack.pop()!) ?? []) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return ids;
}

/** Notion-style project knowledge base: folder/page tree on the left, the open doc on the right. */
export function ProjectDocs({ projectId }: { projectId: string }) {
  // Teammates with a doc open show beside it in the tree (the open doc shows them in its header)
  const presence = usePresence();
  const { slug, workspaceFetch } = useWorkspacePaths();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('doc');

  const treeKey = useMemo(() => ['project-docs', slug, projectId] as const, [slug, projectId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: treeKey,
    queryFn: async () => {
      const res = await workspaceFetch(`/api/projects/${projectId}/docs`);
      if (!res.ok) throw new Error('Failed to load docs');
      return (await res.json()) as DocsResponse;
    },
    enabled: !!slug,
    // Realtime is best-effort (in-process hub), so also poll for teammates' changes
    refetchInterval: 30_000,
  });

  const { data: mentionUsers } = useQuery({
    queryKey: ['project-mentionable', slug, projectId],
    queryFn: async () => {
      const res = await workspaceFetch(`/api/projects/${projectId}/mentionable`);
      if (!res.ok) return [] as MentionUser[];
      return (await res.json()) as MentionUser[];
    },
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });

  const docs = useMemo(() => data?.docs ?? [], [data?.docs]);
  const canWrite = data?.canWrite ?? false;
  const index = useMemo(() => childrenIndex(docs), [docs]);
  const byId = useMemo(() => new Map(docs.map((d) => [d.id, d] as const)), [docs]);
  const selected = selectedId ? byId.get(selectedId) : undefined;

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [remoteTick, setRemoteTick] = useState(0);
  const [busy, setBusy] = useState(false);
  // Phones: the doc tree collapses above the editor (always shown from lg up).
  const [treeOpen, setTreeOpen] = useState(false);

  const select = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set('doc', id);
      else params.delete('doc');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Land on the first page instead of an empty pane
  useEffect(() => {
    if (selectedId || docs.length === 0) return;
    const firstPage = (function find(parent: string): DocNode | undefined {
      for (const node of index.get(parent) ?? []) {
        if (node.kind === 'PAGE') return node;
        const nested = find(node.id);
        if (nested) return nested;
      }
      return undefined;
    })(ROOT);
    if (firstPage) select(firstPage.id);
  }, [docs.length, index, select, selectedId]);

  useRealtime({
    types: [REALTIME_EVENTS.PROJECT_DOC_UPDATED],
    onEvent: (e) => {
      if (e.payload?.projectId !== projectId) return;
      if (e.userId && e.userId === session?.user?.id) return;
      void queryClient.invalidateQueries({ queryKey: treeKey });
      if (e.payload?.docId === selectedId) setRemoteTick((t) => t + 1);
    },
  });

  const refreshTree = useCallback(
    () => queryClient.invalidateQueries({ queryKey: treeKey }),
    [queryClient, treeKey]
  );

  const patchTreeNode = useCallback(
    (docId: string, patch: Partial<DocNode>) => {
      queryClient.setQueryData<DocsResponse>(treeKey, (prev) =>
        prev
          ? { ...prev, docs: prev.docs.map((d) => (d.id === docId ? { ...d, ...patch } : d)) }
          : prev
      );
    },
    [queryClient, treeKey]
  );

  const request = useCallback(
    async (url: string, init: RequestInit, fallbackError: string) => {
      const res = await workspaceFetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init.headers },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || fallbackError);
      return body;
    },
    [workspaceFetch]
  );

  const createDoc = async (kind: DocKind, parentId: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const created = (await request(
        `/api/projects/${projectId}/docs`,
        { method: 'POST', body: JSON.stringify({ kind, parentId }) },
        'Could not create'
      )) as DocNode;
      if (parentId) {
        setCollapsed((prev) => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }
      await refreshTree();
      if (kind === 'PAGE') {
        select(created.id);
      } else {
        setRenamingId(created.id);
        setRenameValue(created.title);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create');
    } finally {
      setBusy(false);
    }
  };

  const commitRename = async () => {
    const id = renamingId;
    if (!id) return;
    setRenamingId(null);
    const title = renameValue.trim();
    const current = byId.get(id);
    if (!title || !current || title === current.title) return;
    patchTreeNode(id, { title });
    try {
      await request(
        `/api/projects/${projectId}/docs/${id}`,
        { method: 'PATCH', body: JSON.stringify({ title }) },
        'Could not rename'
      );
      // The open editor holds its own copy of the title
      if (id === selectedId) setRemoteTick((t) => t + 1);
    } catch (e) {
      patchTreeNode(id, { title: current.title });
      toast.error(e instanceof Error ? e.message : 'Could not rename');
    }
  };

  const moveDoc = async (id: string, parentId: string | null) => {
    const current = byId.get(id);
    if (!current || current.parentId === parentId) return;
    if (parentId && subtreeIds(index, id).has(parentId)) {
      toast.error('Cannot move an item inside itself');
      return;
    }
    try {
      await request(
        `/api/projects/${projectId}/docs/${id}`,
        { method: 'PATCH', body: JSON.stringify({ parentId }) },
        'Could not move'
      );
      if (parentId) {
        setCollapsed((prev) => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }
      await refreshTree();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not move');
    }
  };

  const reorder = async (id: string, direction: -1 | 1) => {
    const current = byId.get(id);
    if (!current) return;
    const siblings = [...(index.get(current.parentId ?? ROOT) ?? [])];
    const from = siblings.findIndex((s) => s.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= siblings.length) return;
    [siblings[from], siblings[to]] = [siblings[to], siblings[from]];
    const changes = siblings
      .map((s, i) => ({ id: s.id, sortOrder: i, changed: s.sortOrder !== i }))
      .filter((s) => s.changed);
    for (const change of changes) patchTreeNode(change.id, { sortOrder: change.sortOrder });
    try {
      await Promise.all(
        changes.map((change) =>
          request(
            `/api/projects/${projectId}/docs/${change.id}`,
            { method: 'PATCH', body: JSON.stringify({ sortOrder: change.sortOrder }) },
            'Could not reorder'
          )
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reorder');
      await refreshTree();
    }
  };

  const deleteDoc = async (node: DocNode) => {
    const nested = subtreeIds(index, node.id).size - 1;
    const ok = await confirmAction({
      title: `Delete “${node.title}”?`,
      description:
        nested > 0
          ? `This also deletes the ${nested} item${nested === 1 ? '' : 's'} inside it. This cannot be undone.`
          : 'This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    const removed = subtreeIds(index, node.id);
    try {
      await request(
        `/api/projects/${projectId}/docs/${node.id}`,
        { method: 'DELETE' },
        'Could not delete'
      );
      if (selectedId && removed.has(selectedId)) select(null);
      await refreshTree();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    }
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const folders = useMemo(() => docs.filter((d) => d.kind === 'FOLDER'), [docs]);

  const renderNodes = (parent: string, depth: number): React.ReactNode =>
    (index.get(parent) ?? []).map((node, position, siblings) => {
      const children = index.get(node.id) ?? [];
      const expandable = node.kind === 'FOLDER' || children.length > 0;
      const open = !collapsed.has(node.id);
      const active = node.id === selectedId;
      const FolderIcon = open ? FolderOpen : Folder;

      return (
        <li key={node.id}>
          <div
            draggable={canWrite && renamingId !== node.id}
            onDragStart={(e) => {
              setDragId(node.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              setDragId(null);
              setDropTarget(null);
            }}
            onDragOver={(e) => {
              if (!dragId || dragId === node.id) return;
              e.preventDefault();
              setDropTarget(node.id);
            }}
            onDragLeave={() => setDropTarget((t) => (t === node.id ? null : t))}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const moving = dragId;
              setDragId(null);
              setDropTarget(null);
              if (moving && moving !== node.id) void moveDoc(moving, node.id);
            }}
            className={cn(
              'group flex h-10 items-center gap-1 rounded-md pr-1 text-sm lg:h-8',
              active ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-muted/70',
              dropTarget === node.id && 'ring-1 ring-primary',
              dragId === node.id && 'opacity-50'
            )}
            style={{ paddingLeft: 4 + depth * 14 }}
          >
            <button
              type="button"
              aria-label={open ? 'Collapse' : 'Expand'}
              onClick={() => toggle(node.id)}
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/15',
                !expandable && 'invisible'
              )}
            >
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            {renamingId === node.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => void commitRename()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="h-6 min-w-0 flex-1 rounded border bg-background px-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  select(node.id);
                  setTreeOpen(false);
                }}
                onDoubleClick={() => {
                  if (!canWrite) return;
                  setRenamingId(node.id);
                  setRenameValue(node.title);
                }}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none">
                  {node.icon ? (
                    node.icon
                  ) : node.kind === 'FOLDER' ? (
                    <FolderIcon className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <span className="truncate">{node.title}</span>
                {node.id !== selectedId ? (
                  <LiveViewers people={presence.docViewers(node.id)} className="ml-auto" />
                ) : null}
              </button>
            )}

            {canWrite && renamingId !== node.id ? (
              <div className="flex shrink-0 items-center focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                <button
                  type="button"
                  title="Add a page inside"
                  aria-label="Add a page inside"
                  onClick={() => void createDoc('PAGE', node.id)}
                  className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground lg:h-6 lg:w-6"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="More actions"
                      className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground lg:h-6 lg:w-6"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    <DropdownMenuItem
                      onSelect={() => {
                        setRenamingId(node.id);
                        setRenameValue(node.title);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void createDoc('PAGE', node.id)}>
                      <FilePlus2 className="mr-2 h-4 w-4" />
                      New page inside
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void createDoc('FOLDER', node.id)}>
                      <FolderPlus className="mr-2 h-4 w-4" />
                      New folder inside
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <CornerUpLeft className="mr-2 h-4 w-4" />
                        Move to
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-64 w-52 overflow-y-auto">
                        <DropdownMenuItem
                          disabled={node.parentId === null}
                          onSelect={() => void moveDoc(node.id, null)}
                        >
                          Top level
                        </DropdownMenuItem>
                        {folders
                          .filter((f) => !subtreeIds(index, node.id).has(f.id))
                          .map((folder) => (
                            <DropdownMenuItem
                              key={folder.id}
                              disabled={node.parentId === folder.id}
                              onSelect={() => void moveDoc(node.id, folder.id)}
                            >
                              <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span className="truncate">{folder.title}</span>
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem
                      disabled={position === 0}
                      onSelect={() => void reorder(node.id, -1)}
                    >
                      <ArrowUp className="mr-2 h-4 w-4" />
                      Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={position === siblings.length - 1}
                      onSelect={() => void reorder(node.id, 1)}
                    >
                      <ArrowDown className="mr-2 h-4 w-4" />
                      Move down
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => void deleteDoc(node)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>

          {expandable && open ? (
            children.length > 0 ? (
              <ul>{renderNodes(node.id, depth + 1)}</ul>
            ) : (
              <p
                className="py-1 text-xs text-muted-foreground"
                style={{ paddingLeft: 30 + (depth + 1) * 14 }}
              >
                Empty
              </p>
            )
          ) : null}
        </li>
      );
    });

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] overflow-hidden rounded-lg border bg-background lg:h-[calc(100dvh-13rem)]">
        <div className="hidden w-64 shrink-0 space-y-2 border-r p-3 lg:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded" />
          ))}
        </div>
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={FileText}
        title="Docs could not be loaded"
        description="Check your connection and try again."
        actionLabel="Retry"
        onAction={() => void refreshTree()}
      />
    );
  }

  const selectedChildren = selected ? (index.get(selected.id) ?? []) : [];

  return (
    <div className="flex min-h-[480px] min-w-0 flex-col rounded-lg border bg-background lg:h-[calc(100dvh-13rem)] lg:flex-row lg:overflow-hidden">
      {/* Tree */}
      <aside
        className="flex shrink-0 flex-col border-b lg:w-64 lg:border-b-0 lg:border-r"
        onDragOver={(e) => {
          if (dragId) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const moving = dragId;
          setDragId(null);
          setDropTarget(null);
          if (moving) void moveDoc(moving, null);
        }}
      >
        <div
          className={cn(
            'flex h-12 shrink-0 items-center justify-between gap-1 px-3 lg:h-11 lg:border-b',
            (treeOpen || !selected) && 'border-b'
          )}
        >
          <button
            type="button"
            aria-expanded={treeOpen || !selected}
            onClick={() => setTreeOpen((v) => !v)}
            className="-ml-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-2 text-left lg:pointer-events-none lg:py-0"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Docs
            </span>
            {selected ? (
              <span className="truncate text-sm font-medium lg:hidden">{selected.title}</span>
            ) : null}
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform lg:hidden',
                (treeOpen || !selected) && 'rotate-180'
              )}
            />
          </button>
          {canWrite ? (
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 lg:h-7 lg:w-7"
                title="New folder"
                aria-label="New folder"
                disabled={busy}
                onClick={() => void createDoc('FOLDER', null)}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 lg:h-7 lg:w-7"
                title="New page"
                aria-label="New page"
                disabled={busy}
                onClick={() => void createDoc('PAGE', null)}
              >
                <FilePlus2 className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
        <nav
          className={cn(
            'max-h-[50dvh] min-h-0 flex-1 overflow-y-auto p-1.5 lg:block lg:max-h-none',
            treeOpen || !selected ? 'block' : 'hidden'
          )}
          aria-label="Project docs"
        >
          {docs.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No docs yet.</p>
          ) : (
            <ul>{renderNodes(ROOT, 0)}</ul>
          )}
        </nav>
      </aside>

      {/* Open doc */}
      <section className="min-h-0 min-w-0 flex-1">
        {docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Start this project’s knowledge base"
            description="Keep briefs, meeting notes, credentials checklists and specs next to the work. Organise pages into folders, or nest pages inside pages."
            actionLabel={canWrite ? 'Create the first page' : undefined}
            onAction={canWrite ? () => void createDoc('PAGE', null) : undefined}
            className="h-full"
          />
        ) : !selected ? (
          <EmptyState
            icon={FileText}
            title="Select a doc"
            description="Pick a page from the list to read or edit it."
            className="h-full"
          />
        ) : selected.kind === 'FOLDER' ? (
          <div className="h-full overflow-y-auto p-4 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight">
                {selected.icon ? (
                  <span>{selected.icon}</span>
                ) : (
                  <FolderOpen className="h-6 w-6 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{selected.title}</span>
              </h2>
              {canWrite ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void createDoc('FOLDER', selected.id)}
                  >
                    <FolderPlus className="mr-1.5 h-4 w-4" />
                    Folder
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void createDoc('PAGE', selected.id)}
                  >
                    <FilePlus2 className="mr-1.5 h-4 w-4" />
                    New page
                  </Button>
                </div>
              ) : null}
            </div>
            {selectedChildren.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">This folder is empty.</p>
            ) : (
              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {selectedChildren.map((child) => (
                  <li key={child.id}>
                    <button
                      type="button"
                      onClick={() => select(child.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {child.icon ? (
                          child.icon
                        ) : child.kind === 'FOLDER' ? (
                          <Folder className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{child.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(child.updatedAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <ProjectDocEditor
            key={selected.id}
            projectId={projectId}
            docId={selected.id}
            canWrite={canWrite}
            currentUserId={session?.user?.id}
            mentionUsers={mentionUsers}
            remoteTick={remoteTick}
            onMetaChange={patchTreeNode}
          />
        )}
      </section>
    </div>
  );
}

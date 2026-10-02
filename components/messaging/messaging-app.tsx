'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { ArrowLeft, Info, Lock, MessageSquare, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { useRealtime } from '@/hooks/use-realtime';
import { usePresence } from '@/hooks/use-presence';
import { REALTIME_EVENTS } from '@/lib/realtime/events';
import { cn } from '@/lib/utils';
import { ConversationList } from './conversation-list';
import { ConversationAvatar } from './conversation-avatar';
import { ConversationDetails } from './conversation-details';
import { MessageList } from './message-list';
import { Composer } from './composer';
import { NewConversationDialog } from './new-conversation-dialog';
import {
  displayName,
  flattenMessages,
  messagingKeys,
  useConversation,
  useConversationActions,
  useConversations,
  useMessages,
  useMessagingApi,
  usePeople,
  type ChatMessage,
  type ConversationType,
  type Person,
} from './use-messaging';

const ONLINE_WINDOW_MS = 5 * 60_000;
const TYPING_TTL_MS = 5000;

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return desktop;
}

/** Team messaging: direct messages, groups and broadcasts for the current workspace. */
export function MessagingApp() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { slug } = useMessagingApi();
  const isDesktop = useIsDesktop();

  const selectedId = searchParams.get('c');
  const sessionUser = session?.user;
  const meId = sessionUser?.id;

  const { data: conversations = [], isLoading: listLoading } = useConversations();
  const { data: peopleData } = usePeople();
  const people = useMemo(() => peopleData?.people ?? [], [peopleData]);
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p] as const)), [people]);
  const me: Person | null = useMemo(
    () =>
      (meId && peopleById.get(meId)) ||
      (sessionUser
        ? {
            id: sessionUser.id,
            name: sessionUser.name ?? null,
            email: sessionUser.email ?? '',
            image: sessionUser.image ?? null,
          }
        : null),
    [meId, peopleById, sessionUser]
  );
  // Online = the workspace presence heartbeat, plus anyone recently on this page
  const presence = usePresence();
  const onlineIds = useMemo(() => {
    const now = Date.now();
    const ids = new Set(presence.onlineIds);
    for (const p of people) {
      if (p.lastSeenAt && now - new Date(p.lastSeenAt).getTime() < ONLINE_WINDOW_MS) ids.add(p.id);
    }
    return ids;
  }, [people, presence.onlineIds]);

  const detail = useConversation(selectedId);
  const messagesQuery = useMessages(selectedId);
  const messagePages = messagesQuery.data;
  const messages = useMemo(() => flattenMessages(messagePages), [messagePages]);
  const actions = useConversationActions(selectedId, me);

  const [newKind, setNewKind] = useState<ConversationType | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [typing, setTyping] = useState<Record<string, Record<string, { name: string; at: number }>>>({});

  const select = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set('c', id);
      else params.delete('c');
      router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
      setReplyTo(null);
      setEditing(null);
    },
    [pathname, router, searchParams]
  );

  // Desktop opens the most recent conversation instead of an empty pane
  useEffect(() => {
    if (!selectedId && isDesktop && conversations.length > 0) select(conversations[0].id);
  }, [conversations, isDesktop, select, selectedId]);

  // A conversation we can no longer see (deleted, removed from it)
  useEffect(() => {
    if (selectedId && detail.isError) select(null);
  }, [detail.isError, select, selectedId]);

  // Reading: mark read when opened and whenever new messages arrive while visible
  const lastMessageId = messages[messages.length - 1]?.id;
  const markRead = actions.markRead;
  useEffect(() => {
    if (!selectedId || !lastMessageId || document.visibilityState !== 'visible') return;
    void markRead();
  }, [selectedId, lastMessageId, markRead]);

  // Realtime: ids only — refetch what changed through the API
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  useRealtime({
    types: [REALTIME_EVENTS.CONVERSATION_UPDATED, REALTIME_EVENTS.CONVERSATION_TYPING],
    onEvent: (event) => {
      const payload = event.payload as Record<string, string | null>;
      const conversationId = payload.conversationId;
      if (!conversationId) return;

      if (event.type === REALTIME_EVENTS.CONVERSATION_TYPING) {
        if (payload.userId === meId) return;
        setTyping((prev) => ({
          ...prev,
          [conversationId]: {
            ...(prev[conversationId] ?? {}),
            [payload.userId as string]: { name: (payload.name as string) || 'Someone', at: Date.now() },
          },
        }));
        return;
      }

      void queryClient.invalidateQueries({ queryKey: messagingKeys.list(slug) });
      void queryClient.invalidateQueries({ queryKey: messagingKeys.unread(slug) });
      if (conversationId === selectedRef.current) {
        if (payload.change === 'members' || payload.change === 'details') {
          void queryClient.invalidateQueries({ queryKey: messagingKeys.detail(slug, conversationId) });
        }
        if (payload.actorId !== meId || payload.change !== 'message') {
          void queryClient.invalidateQueries({ queryKey: messagingKeys.messages(slug, conversationId) });
        }
        // The sender stopped typing once their message lands
        if (payload.change === 'message' && payload.actorId) {
          setTyping((prev) => {
            const current = { ...(prev[conversationId] ?? {}) };
            delete current[payload.actorId as string];
            return { ...prev, [conversationId]: current };
          });
        }
      }
    },
  });

  // Expire typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        let changed = false;
        const next: typeof prev = {};
        for (const [cid, users] of Object.entries(prev)) {
          const kept = Object.fromEntries(Object.entries(users).filter(([, v]) => now - v.at < TYPING_TTL_MS));
          if (Object.keys(kept).length !== Object.keys(users).length) changed = true;
          next[cid] = kept;
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const typingNames = useMemo(
    () => Object.values(typing[selectedId ?? ''] ?? {}).map((t) => t.name),
    [selectedId, typing]
  );

  const conversation = detail.data;
  const summary = conversations.find((c) => c.id === selectedId);
  const showList = isDesktop || !selectedId;
  const showThread = isDesktop || !!selectedId;

  const header = conversation ?? summary;
  const subtitle = (() => {
    if (!header) return '';
    if (header.type === 'DIRECT') {
      const other = header.otherUser;
      if (!other) return '';
      if (onlineIds.has(other.id)) return 'Active now';
      const seen = peopleById.get(other.id)?.lastSeenAt;
      return seen ? `Active ${formatDistanceToNowStrict(new Date(seen), { addSuffix: true })}` : other.email;
    }
    const count = conversation?.members.length ?? summary?.memberCount ?? 0;
    return `${header.type === 'BROADCAST' ? 'Broadcast · ' : ''}${count} member${count === 1 ? '' : 's'}`;
  })();

  const detailsPanel = conversation ? (
    <ConversationDetails
      conversation={conversation}
      people={people}
      meId={meId}
      onlineIds={onlineIds}
      onClose={() => setDetailsOpen(false)}
      onLeft={() => {
        setDetailsOpen(false);
        select(null);
      }}
    />
  ) : null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full min-h-0 overflow-hidden bg-background">
        {showList ? (
          <div className={cn('flex min-h-0 min-w-0 flex-col', isDesktop ? 'w-80 shrink-0 border-r' : 'w-full')}>
            <ConversationList
              conversations={conversations}
              loading={listLoading}
              selectedId={selectedId}
              onlineIds={onlineIds}
              onSelect={select}
              onNew={setNewKind}
            />
          </div>
        ) : null}

        {showThread ? (
          <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Conversation">
            {!selectedId ? (
              <EmptyState
                icon={MessageSquare}
                title={conversations.length ? 'Pick a conversation' : 'Start talking with your team'}
                description="Message a teammate directly, create a group for a project, or post announcements in a broadcast."
                actionLabel="New message"
                onAction={() => setNewKind('DIRECT')}
                className="h-full"
              />
            ) : (
              <>
                <header className="flex h-14 shrink-0 items-center gap-3 border-b px-3 sm:px-5">
                  {!isDesktop ? (
                    <Button variant="ghost" size="icon" className="-ml-2 h-10 w-10 shrink-0" aria-label="Back to conversations" onClick={() => select(null)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {header ? (
                    <>
                      <ConversationAvatar
                        conversation={header}
                        size="md"
                        online={header.type === 'DIRECT' && header.otherUser ? onlineIds.has(header.otherUser.id) : undefined}
                      />
                      <button type="button" onClick={() => setDetailsOpen((v) => !v)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-semibold">{header.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  )}
                  <Button
                    variant={detailsOpen ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-10 w-10 shrink-0 lg:h-8 lg:w-8"
                    aria-label="Conversation details"
                    aria-pressed={detailsOpen}
                    onClick={() => setDetailsOpen((v) => !v)}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </header>

                {conversation?.description && conversation.type !== 'DIRECT' ? (
                  <p className="shrink-0 truncate border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground sm:px-5">
                    {conversation.description}
                  </p>
                ) : null}

                {messagesQuery.isLoading ? (
                  <div className="flex-1 space-y-5 p-3 sm:p-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className={cn('h-3.5', i % 2 ? 'w-2/3' : 'w-1/2')} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <MessageList
                    messages={messages}
                    me={me}
                    people={peopleById}
                    canModerate={!!conversation?.canManage}
                    hasMore={!!messagesQuery.hasNextPage}
                    loadingMore={messagesQuery.isFetchingNextPage}
                    onLoadMore={() => void messagesQuery.fetchNextPage()}
                    typingNames={typingNames}
                    onReply={(m) => {
                      setEditing(null);
                      setReplyTo(m);
                    }}
                    onEdit={(m) => {
                      setReplyTo(null);
                      setEditing(m);
                    }}
                    onDelete={(m) => actions.remove.mutate(m.id)}
                    onReact={(m, emoji) => actions.react.mutate({ messageId: m.id, emoji })}
                  />
                )}

                {conversation && !conversation.canPost ? (
                  <div className="flex shrink-0 items-center justify-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
                    {conversation.type === 'BROADCAST' ? <Megaphone className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {conversation.type === 'BROADCAST'
                      ? 'Only admins can post in this broadcast. You can react to announcements.'
                      : 'This conversation is archived.'}
                  </div>
                ) : (
                  <Composer
                    conversationKey={selectedId}
                    members={conversation?.members ?? []}
                    meId={meId}
                    placeholder={
                      header
                        ? header.type === 'DIRECT'
                          ? `Message ${header.name}`
                          : `Message ${header.name}`
                        : 'Write a message'
                    }
                    replyTo={replyTo}
                    editing={editing}
                    onCancelReply={() => setReplyTo(null)}
                    onCancelEdit={() => setEditing(null)}
                    onTyping={actions.typing}
                    onSend={(content, attachments) => {
                      actions.send.mutate({ content, attachments, replyTo });
                      setReplyTo(null);
                    }}
                    onSaveEdit={(content) => {
                      if (editing) actions.edit.mutate({ messageId: editing.id, content });
                      setEditing(null);
                    }}
                  />
                )}
              </>
            )}
          </section>
        ) : null}

        {selectedId && detailsOpen && isDesktop && detailsPanel ? (
          <div className="w-80 shrink-0 border-l">{detailsPanel}</div>
        ) : null}
      </div>

      {!isDesktop ? (
        <Sheet open={detailsOpen && !!detailsPanel} onOpenChange={setDetailsOpen}>
          <SheetContent side="right" className="w-[min(100vw,22rem)] p-0" srOnlyTitle="Conversation details">
            {detailsPanel}
          </SheetContent>
        </Sheet>
      ) : null}

      <NewConversationDialog
        kind={newKind}
        people={people}
        meId={meId}
        isWorkspaceAdmin={session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'}
        onClose={() => setNewKind(null)}
        onCreated={(id) => {
          void queryClient.invalidateQueries({ queryKey: messagingKeys.list(slug) });
          select(id);
        }}
      />
    </TooltipProvider>
  );
}

export { displayName };

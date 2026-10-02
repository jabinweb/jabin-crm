'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { Maximize2, MessageCircle, Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useRealtime } from '@/hooks/use-realtime';
import { usePresence } from '@/hooks/use-presence';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { REALTIME_EVENTS } from '@/lib/realtime/events';
import { cn } from '@/lib/utils';
import { ConversationList } from './conversation-list';
import { ConversationAvatar } from './conversation-avatar';
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
  useCreateConversation,
  useMessages,
  useMessagingApi,
  usePeople,
  useUnreadMessages,
  type ChatMessage,
  type ConversationType,
  type Person,
} from './use-messaging';

/*
 * Messenger: Facebook-style chat from anywhere in the dashboard. The header button opens
 * recent chats with an "Active now" row; picking one docks a chat window at the bottom
 * of the screen. Windows reuse the Messages page's list, thread and composer.
 */

const MAX_OPEN = 2;
const TYPING_TTL_MS = 5000;

type DockedChat = { id: string; minimized: boolean };

type MessengerContextValue = {
  openChat: (id: string) => void;
  openDirect: (userId: string) => void;
  startNew: (kind: ConversationType) => void;
  onlineIds: Set<string>;
  online: Person[];
  meId?: string;
  /** Phones and tablets use the full Messages page instead of docked windows. */
  docked: boolean;
};

const MessengerContext = createContext<MessengerContextValue | null>(null);

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return desktop;
}

export function MessengerProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const meId = session?.user?.id;
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { path } = useWorkspacePaths();
  const { slug } = useMessagingApi();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const onMessagesPage = /\/dashboard\/messages(\/|$)/.test(pathname);
  const docked = isDesktop && !onMessagesPage;

  const presence = usePresence();
  const { data: peopleData } = usePeople();
  const people = useMemo(() => peopleData?.people ?? [], [peopleData]);
  const online = useMemo(
    () => presence.online.filter((p) => p.id !== meId) as Person[],
    [presence.online, meId]
  );

  const [chats, setChats] = useState<DockedChat[]>([]);
  const [newKind, setNewKind] = useState<ConversationType | null>(null);
  const [typing, setTyping] = useState<Record<string, Record<string, { name: string; at: number }>>>({});
  const createConversation = useCreateConversation();

  const openChat = useCallback(
    (id: string) => {
      if (!docked) {
        router.push(path(`/dashboard/messages?c=${encodeURIComponent(id)}`));
        return;
      }
      setChats((prev) => {
        const rest = prev.filter((c) => c.id !== id);
        // Newest on the right; the oldest window closes past MAX_OPEN
        return [...rest, { id, minimized: false }].slice(-MAX_OPEN);
      });
    },
    [docked, path, router]
  );

  const openDirect = useCallback(
    (userId: string) => {
      createConversation.mutate(
        { type: 'DIRECT', userId },
        { onSuccess: (res) => openChat(res.id) }
      );
    },
    [createConversation, openChat]
  );

  // Leaving desktop / going to the Messages page hands chats over to the full page
  useEffect(() => {
    if (!docked) setChats([]);
  }, [docked]);

  // Realtime for docked windows and the unread badge (ids only — refetch what changed)
  const openIdsRef = useRef<string[]>([]);
  useEffect(() => {
    openIdsRef.current = chats.map((c) => c.id);
  }, [chats]);

  useRealtime({
    enabled: !onMessagesPage, // the Messages page runs its own subscription
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
      if (!openIdsRef.current.includes(conversationId)) return;
      if (payload.change === 'members' || payload.change === 'details') {
        void queryClient.invalidateQueries({ queryKey: messagingKeys.detail(slug, conversationId) });
      }
      if (payload.actorId !== meId || payload.change !== 'message') {
        void queryClient.invalidateQueries({ queryKey: messagingKeys.messages(slug, conversationId) });
      }
      if (payload.change === 'message' && payload.actorId) {
        setTyping((prev) => {
          const current = { ...(prev[conversationId] ?? {}) };
          delete current[payload.actorId as string];
          return { ...prev, [conversationId]: current };
        });
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

  const value = useMemo<MessengerContextValue>(
    () => ({
      openChat,
      openDirect,
      startNew: setNewKind,
      onlineIds: presence.onlineIds,
      online,
      meId,
      docked,
    }),
    [openChat, openDirect, presence.onlineIds, online, meId, docked]
  );

  return (
    <MessengerContext.Provider value={value}>
      {children}
      {docked && chats.length > 0 ? (
        <TooltipProvider delayDuration={300}>
          {/* Left of the assistant button (bottom-right), attached to the screen bottom */}
          <div className="pointer-events-none fixed bottom-0 right-24 z-40 flex items-end gap-3">
            {chats.map((chat) => (
              <ChatWindow
                key={chat.id}
                id={chat.id}
                minimized={chat.minimized}
                people={people}
                typingNames={Object.values(typing[chat.id] ?? {}).map((t) => t.name)}
                onToggle={() =>
                  setChats((prev) =>
                    prev.map((c) => (c.id === chat.id ? { ...c, minimized: !c.minimized } : c))
                  )
                }
                onClose={() => setChats((prev) => prev.filter((c) => c.id !== chat.id))}
                onExpand={() => {
                  setChats((prev) => prev.filter((c) => c.id !== chat.id));
                  router.push(path(`/dashboard/messages?c=${encodeURIComponent(chat.id)}`));
                }}
              />
            ))}
          </div>
        </TooltipProvider>
      ) : null}
      <NewConversationDialog
        kind={newKind}
        people={people}
        meId={meId}
        isWorkspaceAdmin={session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'}
        onClose={() => setNewKind(null)}
        onCreated={(id) => {
          void queryClient.invalidateQueries({ queryKey: messagingKeys.list(slug) });
          openChat(id);
        }}
      />
    </MessengerContext.Provider>
  );
}

export function useMessenger() {
  return useContext(MessengerContext);
}

/** One docked conversation: the Messages page thread in a compact window. */
function ChatWindow({
  id,
  minimized,
  people,
  typingNames,
  onToggle,
  onClose,
  onExpand,
}: {
  id: string;
  minimized: boolean;
  people: Person[];
  typingNames: string[];
  onToggle: () => void;
  onClose: () => void;
  onExpand: () => void;
}) {
  const messenger = useMessenger();
  const { data: session } = useSession();
  const sessionUser = session?.user;
  const meId = sessionUser?.id;
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

  const { data: summaries = [] } = useConversations();
  const detail = useConversation(id);
  const messagesQuery = useMessages(minimized ? null : id);
  const messages = useMemo(() => flattenMessages(messagesQuery.data), [messagesQuery.data]);
  const actions = useConversationActions(id, me);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);

  const conversation = detail.data;
  const summary = summaries.find((c) => c.id === id);
  const header = conversation ?? summary;
  const unread = summary?.unreadCount ?? 0;
  const other = header?.type === 'DIRECT' ? header.otherUser : null;
  const otherOnline = !!other && !!messenger?.onlineIds.has(other.id);

  // Mark read while the window is open and new messages land
  const lastMessageId = messages[messages.length - 1]?.id;
  const markRead = actions.markRead;
  useEffect(() => {
    if (minimized || !lastMessageId || document.visibilityState !== 'visible') return;
    void markRead();
  }, [minimized, lastMessageId, markRead]);

  const subtitle = (() => {
    if (!header) return '';
    if (other) {
      if (otherOnline) return 'Active now';
      const seen = peopleById.get(other.id)?.lastSeenAt;
      return seen ? `Active ${formatDistanceToNowStrict(new Date(seen), { addSuffix: true })}` : '';
    }
    const count = conversation?.members.length ?? summary?.memberCount ?? 0;
    return `${count} member${count === 1 ? '' : 's'}`;
  })();

  return (
    <section
      aria-label={header?.name ? `Chat with ${header.name}` : 'Chat'}
      className={cn(
        'pointer-events-auto flex flex-col overflow-hidden rounded-t-xl border border-b-0 bg-background shadow-2xl',
        minimized ? 'w-64' : 'h-[min(460px,calc(100dvh-6rem))] w-[340px]'
      )}
    >
      <header
        className={cn(
          'flex h-12 shrink-0 items-center gap-2 border-b px-2',
          unread > 0 && minimized && 'bg-primary/5'
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted/60"
          aria-label={minimized ? 'Open chat' : 'Minimize chat'}
        >
          {header ? (
            <ConversationAvatar conversation={header} size="md" online={other ? otherOnline : undefined} />
          ) : null}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {header?.name ?? 'Loading…'}
              {unread > 0 && minimized ? (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 align-middle text-[10px] font-semibold text-primary-foreground">
                  {unread}
                </span>
              ) : null}
            </span>
            {subtitle ? (
              <span
                className={cn(
                  'block truncate text-[11px]',
                  otherOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                )}
              >
                {subtitle}
              </span>
            ) : null}
          </span>
        </button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Open in Messages" onClick={onExpand}>
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={minimized ? 'Open chat' : 'Minimize chat'}
          onClick={onToggle}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Close chat" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      {minimized ? null : (
        <>
          <div className="flex min-h-0 flex-1 flex-col">
            {messagesQuery.isLoading ? (
              <p className="m-auto text-xs text-muted-foreground">Loading messages…</p>
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
          </div>
          {conversation && !conversation.canPost ? (
            <p className="shrink-0 border-t px-3 py-2 text-center text-xs text-muted-foreground">
              {conversation.type === 'BROADCAST' ? 'Only admins can post here.' : 'This conversation is archived.'}
            </p>
          ) : (
            <Composer
              conversationKey={id}
              members={conversation?.members ?? []}
              meId={meId}
              placeholder={header?.name ? `Message ${header.name}` : 'Write a message'}
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
  );
}

/** Header button: unread badge + chats panel with who's online (Facebook Messenger-style). */
export function MessengerButton() {
  const messenger = useMessenger();
  const { path } = useWorkspacePaths();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: unread = 0 } = useUnreadMessages();
  const { data: conversations = [], isLoading } = useConversations();

  if (!messenger) return null;
  const { online, onlineIds, openChat, openDirect, startNew } = messenger;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Messages'}
        >
          <MessageCircle className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-[18px] text-destructive-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex h-[min(560px,calc(100dvh-5rem))] w-[min(calc(100vw-1rem),380px)] flex-col overflow-hidden p-0"
      >
        <TooltipProvider delayDuration={300}>
          {/* Who's online — tap to chat */}
          <div className="shrink-0 border-b px-3 pb-2 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Active now{online.length ? ` · ${online.length}` : ''}
              </span>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  setOpen(false);
                  router.push(path('/dashboard/messages'));
                }}
              >
                See all in Messages
              </button>
            </div>
            {online.length === 0 ? (
              <p className="pb-1 text-xs text-muted-foreground">No teammates online right now.</p>
            ) : (
              <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto pb-1">
                {online.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={`Message ${displayName(p)}`}
                    onClick={() => {
                      setOpen(false);
                      openDirect(p.id);
                    }}
                    className="flex w-14 shrink-0 flex-col items-center gap-1 rounded-md px-1 py-1 hover:bg-muted"
                  >
                    <UserAvatar person={p} size="lg" online />
                    <span className="w-full truncate text-center text-[11px]">
                      {displayName(p).split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <ConversationList
              conversations={conversations}
              loading={isLoading}
              selectedId={null}
              onlineIds={onlineIds}
              onSelect={(id) => {
                setOpen(false);
                openChat(id);
              }}
              onNew={(kind) => {
                setOpen(false);
                startNew(kind);
              }}
            />
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}

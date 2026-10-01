'use client';

import { useCallback, useMemo } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export type Person = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role?: string;
  lastSeenAt?: string | null;
};

export type ConversationType = 'DIRECT' | 'GROUP' | 'BROADCAST';

export type ConversationSummary = {
  id: string;
  type: ConversationType;
  name: string | null;
  description: string | null;
  includesEveryone: boolean;
  projectId: string | null;
  otherUser: Person | null;
  members: Person[];
  memberCount: number;
  myRole: string;
  muted: boolean;
  unreadCount: number;
  lastMessageAt: string;
  lastMessage: { preview: string; senderName: string | null; createdAt: string } | null;
};

export type ConversationDetail = {
  id: string;
  type: ConversationType;
  name: string | null;
  description: string | null;
  includesEveryone: boolean;
  projectId: string | null;
  createdAt: string;
  archivedAt: string | null;
  otherUser: Person | null;
  myRole: string;
  muted: boolean;
  canManage: boolean;
  canPost: boolean;
  members: Array<Person & { role: string }>;
};

export type Attachment = { url: string; name: string; mimeType?: string | null; size?: number | null };

export type ChatMessage = {
  id: string;
  conversationId: string;
  kind: 'TEXT' | 'SYSTEM';
  content: string;
  attachments: Attachment[];
  sender: Person | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyTo: { id: string; sender: Person | null; preview: string } | null;
  reactions: Array<{ emoji: string; userIds: string[] }>;
  /** Client-only: optimistic message not yet confirmed */
  pending?: boolean;
};

type MessagePage = { messages: ChatMessage[]; hasMore: boolean };

export const messagingKeys = {
  list: (slug?: string) => ['conversations', slug] as const,
  detail: (slug: string | undefined, id: string) => ['conversation', slug, id] as const,
  messages: (slug: string | undefined, id: string) => ['conversation-messages', slug, id] as const,
  people: (slug?: string) => ['conversation-people', slug] as const,
  unread: (slug?: string) => ['conversation-unread', slug] as const,
};

async function json<T>(res: Response, fallback: string): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || fallback);
  return body as T;
}

export function useMessagingApi() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const call = useCallback(
    (url: string, init?: RequestInit) =>
      workspaceFetch(url, {
        ...init,
        headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
      }),
    [workspaceFetch]
  );
  return { slug, call };
}

export function useConversations() {
  const { slug, call } = useMessagingApi();
  return useQuery({
    queryKey: messagingKeys.list(slug),
    queryFn: async () =>
      (await json<{ conversations: ConversationSummary[] }>(
        await call('/api/conversations'),
        'Could not load conversations'
      )).conversations,
    enabled: !!slug,
    refetchInterval: 30_000,
  });
}

export function usePeople() {
  const { slug, call } = useMessagingApi();
  return useQuery({
    queryKey: messagingKeys.people(slug),
    queryFn: async () =>
      json<{ people: Person[]; me: string }>(await call('/api/conversations/people'), 'Could not load people'),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

export function useConversation(id: string | null) {
  const { slug, call } = useMessagingApi();
  return useQuery({
    queryKey: messagingKeys.detail(slug, id ?? ''),
    queryFn: async () =>
      json<ConversationDetail>(await call(`/api/conversations/${id}`), 'Conversation not found'),
    enabled: !!slug && !!id,
    retry: false,
  });
}

export function useMessages(id: string | null) {
  const { slug, call } = useMessagingApi();
  return useInfiniteQuery({
    queryKey: messagingKeys.messages(slug, id ?? ''),
    queryFn: async ({ pageParam }) =>
      json<MessagePage>(
        await call(
          `/api/conversations/${id}/messages${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`
        ),
        'Could not load messages'
      ),
    initialPageParam: '' as string,
    getNextPageParam: (last) => (last.hasMore ? last.messages[0]?.id : undefined),
    enabled: !!slug && !!id,
    refetchInterval: 20_000,
  });
}

/** All loaded messages, oldest first. */
export function flattenMessages(data: InfiniteData<MessagePage> | undefined): ChatMessage[] {
  if (!data) return [];
  return [...data.pages].reverse().flatMap((page) => page.messages);
}

/** Mutations for one conversation, with optimistic updates on the message cache. */
export function useConversationActions(id: string | null, me?: Person | null) {
  const { slug, call } = useMessagingApi();
  const queryClient = useQueryClient();
  const messagesKey = messagingKeys.messages(slug, id ?? '');

  const patchMessages = useCallback(
    (update: (messages: ChatMessage[]) => ChatMessage[]) => {
      queryClient.setQueryData<InfiniteData<MessagePage>>(messagesKey, (prev) => {
        if (!prev) return prev;
        // The newest page is pages[0]; optimistic adds go there
        return {
          ...prev,
          pages: prev.pages.map((page, i) =>
            i === 0 ? { ...page, messages: update(page.messages) } : page
          ),
        };
      });
    },
    [messagesKey, queryClient]
  );

  const replaceMessage = useCallback(
    (next: ChatMessage, tempId?: string) => {
      queryClient.setQueryData<InfiniteData<MessagePage>>(messagesKey, (prev) =>
        prev
          ? {
              ...prev,
              pages: prev.pages.map((page) => ({
                ...page,
                messages: page.messages.map((m) => (m.id === (tempId ?? next.id) ? next : m)),
              })),
            }
          : prev
      );
    },
    [messagesKey, queryClient]
  );

  const refreshList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: messagingKeys.list(slug) });
    void queryClient.invalidateQueries({ queryKey: messagingKeys.unread(slug) });
  }, [queryClient, slug]);

  const send = useMutation({
    mutationFn: async (input: { content: string; replyTo?: ChatMessage | null; attachments: Attachment[] }) =>
      json<ChatMessage>(
        await call(`/api/conversations/${id}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            content: input.content,
            replyToId: input.replyTo?.id ?? null,
            attachments: input.attachments,
          }),
        }),
        'Message not sent'
      ),
    onMutate: (input) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      patchMessages((messages) => [
        ...messages,
        {
          id: tempId,
          conversationId: id ?? '',
          kind: 'TEXT',
          content: input.content,
          attachments: input.attachments,
          sender: me ?? null,
          createdAt: new Date().toISOString(),
          editedAt: null,
          deletedAt: null,
          replyTo: input.replyTo
            ? { id: input.replyTo.id, sender: input.replyTo.sender, preview: input.replyTo.content.slice(0, 140) }
            : null,
          reactions: [],
          pending: true,
        },
      ]);
      return { tempId };
    },
    onSuccess: (saved, _input, ctx) => {
      replaceMessage(saved, ctx?.tempId);
      refreshList();
    },
    onError: (error: Error, _input, ctx) => {
      patchMessages((messages) => messages.filter((m) => m.id !== ctx?.tempId));
      toast.error(error.message);
    },
  });

  const edit = useMutation({
    mutationFn: async (input: { messageId: string; content: string }) =>
      json<ChatMessage>(
        await call(`/api/conversations/${id}/messages/${input.messageId}`, {
          method: 'PATCH',
          body: JSON.stringify({ content: input.content }),
        }),
        'Could not edit'
      ),
    onSuccess: (saved) => replaceMessage(saved),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (messageId: string) =>
      json<ChatMessage>(
        await call(`/api/conversations/${id}/messages/${messageId}`, { method: 'DELETE' }),
        'Could not delete'
      ),
    onSuccess: (saved) => {
      replaceMessage(saved);
      refreshList();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const react = useMutation({
    mutationFn: async (input: { messageId: string; emoji: string }) =>
      json<ChatMessage>(
        await call(`/api/conversations/${id}/messages/${input.messageId}`, {
          method: 'POST',
          body: JSON.stringify({ emoji: input.emoji }),
        }),
        'Could not react'
      ),
    onMutate: ({ messageId, emoji }) => {
      if (!me) return;
      patchMessages((messages) =>
        messages.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          const mine = existing?.userIds.includes(me.id);
          const reactions = existing
            ? m.reactions
                .map((r) =>
                  r.emoji === emoji
                    ? { ...r, userIds: mine ? r.userIds.filter((u) => u !== me.id) : [...r.userIds, me.id] }
                    : r
                )
                .filter((r) => r.userIds.length > 0)
            : [...m.reactions, { emoji, userIds: [me.id] }];
          return { ...m, reactions };
        })
      );
    },
    onSuccess: (saved) => replaceMessage(saved),
    onError: (e: Error) => toast.error(e.message),
  });

  const markRead = useCallback(async () => {
    if (!id) return;
    queryClient.setQueryData<ConversationSummary[]>(messagingKeys.list(slug), (prev) =>
      prev?.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
    await call(`/api/conversations/${id}/read`, { method: 'POST' }).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: messagingKeys.unread(slug) });
  }, [call, id, queryClient, slug]);

  const typing = useCallback(() => {
    if (!id) return;
    void call(`/api/conversations/${id}/typing`, { method: 'POST' }).catch(() => undefined);
  }, [call, id]);

  return { send, edit, remove, react, markRead, typing, refreshList };
}

/** Group / broadcast / DM management. */
export function useConversationAdmin(id: string | null) {
  const { slug, call } = useMessagingApi();
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: messagingKeys.detail(slug, id ?? '') });
    void queryClient.invalidateQueries({ queryKey: messagingKeys.list(slug) });
    void queryClient.invalidateQueries({ queryKey: messagingKeys.messages(slug, id ?? '') });
  }, [id, queryClient, slug]);

  const run = useCallback(
    async (url: string, init: RequestInit, fallback: string) => {
      try {
        await json(await call(url, init), fallback);
        invalidate();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : fallback);
        return false;
      }
    },
    [call, invalidate]
  );

  return useMemo(
    () => ({
      update: (patch: Record<string, unknown>) =>
        run(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, 'Could not save'),
      addMembers: (userIds: string[]) =>
        run(`/api/conversations/${id}/members`, { method: 'POST', body: JSON.stringify({ userIds }) }, 'Could not add people'),
      setRole: (userId: string, role: 'ADMIN' | 'MEMBER') =>
        run(`/api/conversations/${id}/members`, { method: 'PATCH', body: JSON.stringify({ userId, role }) }, 'Could not change role'),
      removeMember: (userId: string) =>
        run(`/api/conversations/${id}/members?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' }, 'Could not remove'),
      leave: () => run(`/api/conversations/${id}/members`, { method: 'DELETE' }, 'Could not leave'),
      destroy: () => run(`/api/conversations/${id}`, { method: 'DELETE' }, 'Could not delete'),
    }),
    [id, run]
  );
}

export function useCreateConversation() {
  const { slug, call } = useMessagingApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      json<{ id: string }>(
        await call('/api/conversations', { method: 'POST', body: JSON.stringify(input) }),
        'Could not start the conversation'
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: messagingKeys.list(slug) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Unread total for the nav badge. */
export function useUnreadMessages(enabled = true) {
  const { slug, call } = useMessagingApi();
  return useQuery({
    queryKey: messagingKeys.unread(slug),
    queryFn: async () =>
      (await json<{ count: number }>(await call('/api/conversations/unread'), 'unread')).count,
    enabled: enabled && !!slug,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

export function displayName(person: Pick<Person, 'name' | 'email'> | null | undefined) {
  return person?.name?.trim() || person?.email || 'Unknown';
}

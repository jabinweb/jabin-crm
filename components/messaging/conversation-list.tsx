'use client';

import { useMemo, useState } from 'react';
import { format, isThisWeek, isToday } from 'date-fns';
import { BellOff, Megaphone, MessageSquarePlus, Search, Users, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ConversationAvatar } from './conversation-avatar';
import type { ConversationSummary, ConversationType } from './use-messaging';

type Filter = 'ALL' | 'UNREAD' | ConversationType;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'UNREAD', label: 'Unread' },
  { id: 'DIRECT', label: 'Direct' },
  { id: 'GROUP', label: 'Groups' },
  { id: 'BROADCAST', label: 'Broadcasts' },
];

function when(value: string) {
  const date = new Date(value);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isThisWeek(date)) return format(date, 'EEE');
  return format(date, 'd MMM');
}

export function ConversationList({
  conversations,
  loading,
  selectedId,
  onlineIds,
  onSelect,
  onNew,
}: {
  conversations: ConversationSummary[];
  loading: boolean;
  selectedId: string | null;
  onlineIds: Set<string>;
  onSelect: (id: string) => void;
  onNew: (kind: ConversationType) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'UNREAD' && c.unreadCount === 0) return false;
      if (filter !== 'ALL' && filter !== 'UNREAD' && c.type !== filter) return false;
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        c.members.some((m) => m.name?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      );
    });
  }, [conversations, filter, query]);

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 border-b px-3 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight">
            Messages
            {unreadTotal > 0 ? (
              <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 align-middle text-[10px] font-semibold text-primary-foreground">
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </span>
            ) : null}
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5">
                <MessageSquarePlus className="h-4 w-4" />
                New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => onNew('DIRECT')}>
                <UserRound className="mr-2 h-4 w-4" />
                <span>
                  Direct message
                  <span className="block text-xs text-muted-foreground">Talk one to one</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onNew('GROUP')}>
                <Users className="mr-2 h-4 w-4" />
                <span>
                  Group
                  <span className="block text-xs text-muted-foreground">Everyone can post</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onNew('BROADCAST')}>
                <Megaphone className="mr-2 h-4 w-4" />
                <span>
                  Broadcast
                  <span className="block text-xs text-muted-foreground">Only admins post, everyone reads</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people and groups"
            aria-label="Search conversations"
            className="h-9 pl-8"
          />
        </div>

        <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Filter conversations">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                filter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-1.5" aria-label="Conversations">
        {loading ? (
          <div className="space-y-1 p-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {conversations.length === 0
              ? 'No conversations yet. Start one with New.'
              : 'Nothing matches.'}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((c) => {
              const active = c.id === selectedId;
              const unread = c.unreadCount > 0;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                      active ? 'bg-accent' : 'hover:bg-muted/60'
                    )}
                  >
                    <ConversationAvatar
                      conversation={c}
                      online={c.type === 'DIRECT' && c.otherUser ? onlineIds.has(c.otherUser.id) : undefined}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={cn('truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>
                          {c.name || 'Untitled'}
                        </span>
                        {c.muted ? <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Muted" /> : null}
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {when(c.lastMessage?.createdAt ?? c.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-xs',
                            unread ? 'text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {c.lastMessage
                            ? `${c.lastMessage.senderName && c.type !== 'DIRECT' ? `${c.lastMessage.senderName}: ` : c.lastMessage.senderName === 'You' ? 'You: ' : ''}${c.lastMessage.preview}`
                            : c.type === 'DIRECT'
                              ? 'Say hello'
                              : `${c.memberCount} member${c.memberCount === 1 ? '' : 's'}`}
                        </span>
                        {unread ? (
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-1.5 text-[10px] font-semibold leading-4',
                              c.muted ? 'bg-muted-foreground/30 text-foreground' : 'bg-primary text-primary-foreground'
                            )}
                          >
                            {c.unreadCount > 99 ? '99+' : c.unreadCount}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}

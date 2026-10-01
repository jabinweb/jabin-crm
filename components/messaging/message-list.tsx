'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import {
  Copy,
  CornerUpLeft,
  Loader2,
  MoreHorizontal,
  Pencil,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/ui/user-avatar';
import { confirmAction } from '@/lib/confirm-action';
import { chatPlainText } from '@/lib/messaging/mentions';
import { cn } from '@/lib/utils';
import { MessageAttachments, MessageText } from './message-content';
import { displayName, type ChatMessage, type Person } from './use-messaging';

export const REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '🙏', '✅', '🔥'];

const GROUP_WINDOW_MS = 5 * 60_000;

function dayLabel(date: Date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, d MMMM yyyy');
}

type Handlers = {
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string) => void;
};

export function MessageList({
  messages,
  me,
  people,
  canModerate,
  hasMore,
  loadingMore,
  onLoadMore,
  typingNames,
  ...handlers
}: Handlers & {
  messages: ChatMessage[];
  me?: Person | null;
  people: Map<string, Person>;
  /** Owners/admins may delete other people's messages */
  canModerate: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  typingNames: string[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const previousHeight = useRef(0);
  const firstId = messages[0]?.id;
  const lastId = messages[messages.length - 1]?.id;
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Keep the view pinned to the newest message unless the reader scrolled up
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastId, typingNames.length]);

  // Loading older messages must not jump the view
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !previousHeight.current) return;
    el.scrollTop += el.scrollHeight - previousHeight.current;
    previousHeight.current = 0;
  }, [firstId]);

  const conversationId = messages[0]?.conversationId;
  useEffect(() => {
    stickToBottom.current = true;
  }, [conversationId]);

  const jumpTo = (id: string) => {
    const node = scrollRef.current?.querySelector(`[data-message-id="${id}"]`);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId(null), 1600);
  };

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
      onScroll={(e) => {
        const el = e.currentTarget;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (el.scrollTop < 120 && hasMore && !loadingMore) {
          previousHeight.current = el.scrollHeight;
          onLoadMore();
        }
      }}
    >
      {hasMore ? (
        <div className="flex justify-center pb-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            disabled={loadingMore}
            onClick={() => {
              previousHeight.current = scrollRef.current?.scrollHeight ?? 0;
              onLoadMore();
            }}
          >
            {loadingMore ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Load earlier messages
          </Button>
        </div>
      ) : null}

      {messages.map((message, index) => {
        const created = new Date(message.createdAt);
        const prev = messages[index - 1];
        const newDay = !prev || !isSameDay(new Date(prev.createdAt), created);
        const continued =
          !newDay &&
          prev?.kind === 'TEXT' &&
          message.kind === 'TEXT' &&
          prev.sender?.id === message.sender?.id &&
          !message.replyTo &&
          created.getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;

        return (
          <Fragment key={message.id}>
            {newDay ? (
              <div className="relative my-4 flex items-center justify-center" role="separator">
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                <span className="relative rounded-full border bg-background px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {dayLabel(created)}
                </span>
              </div>
            ) : null}
            {message.kind === 'SYSTEM' ? (
              <p className="my-2 text-center text-xs text-muted-foreground">{message.content}</p>
            ) : (
              <MessageRow
                message={message}
                me={me}
                people={people}
                continued={continued}
                highlighted={highlightId === message.id}
                canDelete={message.sender?.id === me?.id || canModerate}
                onJump={jumpTo}
                {...handlers}
              />
            )}
          </Fragment>
        );
      })}

      {typingNames.length > 0 ? (
        <div className="flex items-center gap-2 px-11 pt-1 text-xs text-muted-foreground" aria-live="polite">
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </span>
          {typingNames.length === 1
            ? `${typingNames[0]} is typing…`
            : `${typingNames.slice(0, 2).join(' and ')} are typing…`}
        </div>
      ) : null}
    </div>
  );
}

function MessageRow({
  message,
  me,
  people,
  continued,
  highlighted,
  canDelete,
  onJump,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: Handlers & {
  message: ChatMessage;
  me?: Person | null;
  people: Map<string, Person>;
  continued: boolean;
  highlighted: boolean;
  canDelete: boolean;
  onJump: (id: string) => void;
}) {
  const mine = message.sender?.id === me?.id;
  const deleted = !!message.deletedAt;
  const created = new Date(message.createdAt);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      data-message-id={message.id}
      className={cn(
        'group relative -mx-2 flex gap-3 rounded-md px-2 transition-colors hover:bg-muted/40',
        continued ? 'py-0.5' : 'mt-3 py-1',
        highlighted && 'bg-amber-500/10',
        message.pending && 'opacity-60'
      )}
    >
      <div className="w-8 shrink-0">
        {continued ? (
          <span className="invisible block pt-1 text-right text-[10px] text-muted-foreground group-hover:visible">
            {format(created, 'HH:mm')}
          </span>
        ) : (
          <UserAvatar person={message.sender} size="md" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!continued ? (
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold">{displayName(message.sender)}</span>
            <time
              dateTime={message.createdAt}
              title={format(created, 'PPpp')}
              className="shrink-0 text-[11px] text-muted-foreground"
            >
              {format(created, 'HH:mm')}
            </time>
          </div>
        ) : null}

        {message.replyTo ? (
          <button
            type="button"
            onClick={() => onJump(message.replyTo!.id)}
            className="mb-1 mt-0.5 flex max-w-full items-center gap-1.5 border-l-2 border-primary/40 pl-2 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            <CornerUpLeft className="h-3 w-3 shrink-0" />
            <span className="shrink-0 font-medium">{displayName(message.replyTo.sender)}</span>
            <span className="truncate">{chatPlainText(message.replyTo.preview)}</span>
          </button>
        ) : null}

        <div className="text-sm leading-relaxed">
          {deleted ? (
            <span className="italic text-muted-foreground">This message was deleted</span>
          ) : (
            <>
              {message.content ? <MessageText content={message.content} meId={me?.id} /> : null}
              {message.editedAt ? (
                <span className="ml-1 text-[11px] text-muted-foreground">(edited)</span>
              ) : null}
              <MessageAttachments attachments={message.attachments} />
            </>
          )}
        </div>

        {message.reactions.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((reaction) => {
              const reacted = !!me && reaction.userIds.includes(me.id);
              const names = reaction.userIds
                .map((id) => (id === me?.id ? 'You' : displayName(people.get(id))))
                .join(', ');
              return (
                <Tooltip key={reaction.emoji}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onReact(message, reaction.emoji)}
                      className={cn(
                        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors',
                        reacted
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'bg-background hover:bg-muted'
                      )}
                    >
                      <span>{reaction.emoji}</span>
                      <span className="tabular-nums">{reaction.userIds.length}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{names}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ) : null}
      </div>

      {!deleted && !message.pending ? (
        <div
          className={cn(
            'absolute -top-3 right-2 z-10 flex items-center rounded-md border bg-popover shadow-sm',
            pickerOpen ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'
          )}
        >
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Add reaction"
                className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <SmilePlus className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-1">
              <div className="flex gap-0.5">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReact(message, emoji);
                      setPickerOpen(false);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-muted"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            aria-label="Reply"
            onClick={() => onReply(message)}
            className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <CornerUpLeft className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {message.content ? (
                <DropdownMenuItem
                  onSelect={() => {
                    void navigator.clipboard
                      .writeText(chatPlainText(message.content))
                      .then(() => toast.success('Copied'));
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy text
                </DropdownMenuItem>
              ) : null}
              {mine ? (
                <DropdownMenuItem onSelect={() => onEdit(message)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              ) : null}
              {canDelete ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={async () => {
                      const ok = await confirmAction({
                        title: 'Delete this message?',
                        description: 'It will be removed for everyone in the conversation.',
                        confirmLabel: 'Delete',
                        variant: 'destructive',
                      });
                      if (ok) onDelete(message);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}

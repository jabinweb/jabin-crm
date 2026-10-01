'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Paperclip, Pencil, SendHorizontal, Smile, X, CornerUpLeft, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { CHAT_MENTION_RE, chatPlainText } from '@/lib/messaging/mentions';
import { cn } from '@/lib/utils';
import { displayName, type Attachment, type ChatMessage, type Person } from './use-messaging';

const QUICK_EMOJI = ['😀', '😂', '😊', '😍', '🤔', '😅', '😢', '😮', '👍', '👏', '🙏', '🎉', '🔥', '✅', '❤️', '🚀', '👀', '💯', '🙌', '🤝'];
const MENTION_TRIGGER = /(?:^|\s)@([^\s@]{0,30})$/;
const TYPING_THROTTLE_MS = 3000;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Message box. Mentions show as "@Name" while typing and are converted to
 * `@[Name](userId)` tokens on send, so names stay readable in the textarea.
 */
export function Composer({
  members,
  meId,
  placeholder,
  replyTo,
  editing,
  onCancelReply,
  onCancelEdit,
  onSend,
  onSaveEdit,
  onTyping,
  conversationKey,
}: {
  members: Person[];
  meId?: string;
  placeholder: string;
  replyTo: ChatMessage | null;
  editing: ChatMessage | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (content: string, attachments: Attachment[]) => void;
  onSaveEdit: (content: string) => void;
  onTyping: () => void;
  /** Changes when switching conversations — resets the draft */
  conversationKey: string;
}) {
  const { workspaceFetch } = useWorkspacePaths();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mentionMap = useRef(new Map<string, string>());
  const lastTyping = useRef(0);

  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Fresh draft per conversation
  useEffect(() => {
    setText('');
    setAttachments([]);
    mentionMap.current.clear();
    textareaRef.current?.focus();
  }, [conversationKey]);

  // Editing loads the message, with mention tokens shown as "@Name"
  useEffect(() => {
    if (!editing) return;
    mentionMap.current.clear();
    for (const match of Array.from(editing.content.matchAll(CHAT_MENTION_RE))) {
      mentionMap.current.set(match[1], match[2]);
    }
    setText(chatPlainText(editing.content));
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [editing]);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  // Auto-grow up to ~8 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const candidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => m.id !== meId)
      .filter((m) => !q || m.name?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 6);
  }, [members, meId, mentionQuery]);

  const updateMentionQuery = (value: string, caret: number) => {
    const match = MENTION_TRIGGER.exec(value.slice(0, caret));
    setMentionQuery(match ? match[1] : null);
    setMentionIndex(0);
  };

  const pickMention = (person: Person) => {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const match = MENTION_TRIGGER.exec(before);
    if (!match) return;
    const name = displayName(person);
    mentionMap.current.set(name, person.id);
    const start = caret - match[1].length - 1;
    const next = `${text.slice(0, start)}@${name} ${text.slice(caret)}`;
    setText(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = start + name.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const encode = (value: string) => {
    let out = value;
    const names = Array.from(mentionMap.current.keys()).sort((a, b) => b.length - a.length);
    for (const name of names) {
      const id = mentionMap.current.get(name)!;
      out = out.replace(new RegExp(`@${escapeRegExp(name)}(?![\\w])`, 'g'), `@[${name}](${id})`);
    }
    return out;
  };

  const submit = () => {
    const content = encode(text.trim());
    if (uploading > 0) {
      toast.message('Wait for the upload to finish');
      return;
    }
    if (editing) {
      if (!content) return;
      onSaveEdit(content);
    } else {
      if (!content && attachments.length === 0) return;
      onSend(content, attachments);
      setAttachments([]);
    }
    setText('');
    mentionMap.current.clear();
    setMentionQuery(null);
  };

  const upload = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name} is larger than 25 MB`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('folder', 'chat');
        form.append('isPublic', 'true');
        const res = await workspaceFetch('/api/upload', { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        setAttachments((prev) => [
          ...prev,
          {
            url: data.url,
            name: data.filename || file.name,
            mimeType: data.mimeType || file.type,
            size: data.size || file.size,
          },
        ]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const banner = editing ? (
    <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
      <Pencil className="h-3.5 w-3.5" />
      <span className="flex-1">Editing message — Esc to cancel</span>
      <button type="button" aria-label="Cancel edit" onClick={onCancelEdit} className="hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : replyTo ? (
    <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
      <CornerUpLeft className="h-3.5 w-3.5 shrink-0" />
      <span className="shrink-0">
        Replying to <span className="font-medium text-foreground">{displayName(replyTo.sender)}</span>
      </span>
      <span className="min-w-0 flex-1 truncate">{chatPlainText(replyTo.content)}</span>
      <button type="button" aria-label="Cancel reply" onClick={onCancelReply} className="hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : null;

  return (
    <div className="shrink-0 px-3 pb-3 sm:px-5">
      <div
        className="relative rounded-lg border bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length || editing) return;
          e.preventDefault();
          void upload(e.dataTransfer.files);
        }}
      >
        {banner}

        {attachments.length > 0 || uploading > 0 ? (
          <div className="flex flex-wrap gap-2 border-b px-3 py-2">
            {attachments.map((file) => (
              <span
                key={file.url}
                className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-md border bg-muted/50 py-1 pl-2 pr-1 text-xs"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setAttachments((prev) => prev.filter((a) => a.url !== file.url))}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {uploading > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
              </span>
            ) : null}
          </div>
        ) : null}

        {candidates.length > 0 ? (
          <div
            role="listbox"
            aria-label="Mention someone"
            className="absolute bottom-full left-2 z-20 mb-1 w-64 overflow-hidden rounded-md border bg-popover p-1 shadow-md"
          >
            {candidates.map((person, i) => (
              <button
                key={person.id}
                type="button"
                role="option"
                aria-selected={i === mentionIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMention(person);
                }}
                onMouseEnter={() => setMentionIndex(i)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                  i === mentionIndex && 'bg-accent text-accent-foreground'
                )}
              >
                <UserAvatar person={person} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{displayName(person)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          value={text}
          rows={1}
          placeholder={placeholder}
          aria-label="Message"
          onChange={(e) => {
            setText(e.target.value);
            updateMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
            const now = Date.now();
            if (e.target.value && now - lastTyping.current > TYPING_THROTTLE_MS) {
              lastTyping.current = now;
              onTyping();
            }
          }}
          onClick={(e) =>
            updateMentionQuery(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
          }
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length && !editing) {
              e.preventDefault();
              void upload(files);
            }
          }}
          onKeyDown={(e) => {
            if (candidates.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex((i) => (i + 1) % candidates.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex((i) => (i - 1 + candidates.length) % candidates.length);
                return;
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                pickMention(candidates[mentionIndex] ?? candidates[0]);
                return;
              }
              if (e.key === 'Escape') {
                setMentionQuery(null);
                return;
              }
            }
            if (e.key === 'Escape') {
              if (editing) {
                onCancelEdit();
                setText('');
              } else if (replyTo) onCancelReply();
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="block max-h-[200px] w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />

        <div className="flex items-center gap-1 px-2 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="Attach files"
            disabled={!!editing}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Emoji">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <div className="grid grid-cols-10 gap-0.5">
                {QUICK_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-muted"
                    onClick={() => {
                      setText((t) => `${t}${emoji}`);
                      textareaRef.current?.focus();
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <span className="ml-1 hidden text-[11px] text-muted-foreground sm:inline">
            <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift + Enter</kbd> new line · <kbd className="font-sans">@</kbd> to mention
          </span>
          <Button
            type="button"
            size="sm"
            className="ml-auto h-8 gap-1.5"
            disabled={(!text.trim() && attachments.length === 0) || uploading > 0}
            onClick={submit}
          >
            {editing ? 'Save' : 'Send'}
            {!editing ? <SendHorizontal className="h-3.5 w-3.5" /> : null}
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void upload(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}

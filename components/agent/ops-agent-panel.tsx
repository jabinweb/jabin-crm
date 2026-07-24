'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import {
  Bot,
  Loader2,
  Send,
  X,
  Check,
  Ban,
  ArrowLeft,
  Plus,
  ImagePlus,
  MessageSquare,
  Trash2,
  Building2,
  UserRound,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug';
import { toast } from 'sonner';

type PendingWrite = {
  toolRunId: string;
  toolName: string;
  args: Record<string, unknown>;
  description: string;
};

type ChatImage = {
  mimeType: string;
  url?: string;
  data?: string;
  previewUrl?: string;
  /** History marker — screenshot was local-only and is not in the DB */
  localOnlyPlaceholder?: boolean;
};


type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images?: ChatImage[];
  pendingWrites?: PendingWrite[];
  followUps?: string[];
};

type MentionSuggestion = {
  id: string;
  type: 'employee' | 'user' | 'customer';
  label: string;
  subtitle: string;
  email?: string | null;
  employeeId?: string | null;
  userId?: string | null;
  customerId?: string | null;
};

function getActiveMention(
  text: string,
  caret: number
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = before.match(/(^|[\s\n])@([^\s@]*)$/);
  if (!match || match.index === undefined) return null;
  const atIndex = match.index + match[1].length;
  return { start: atIndex, query: match[2] };
}

function mentionTypeIcon(type: MentionSuggestion['type']) {
  if (type === 'customer') return Building2;
  if (type === 'employee') return Users;
  return UserRound;
}

function mentionTypeLabel(type: MentionSuggestion['type']) {
  if (type === 'customer') return 'Customer';
  if (type === 'employee') return 'Employee';
  return 'User';
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(<span key={key++}>{text.slice(last)}</span>);
  return nodes;
}

function AgentMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul key={key++} className="my-1.5 list-disc space-y-1 pl-4">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      continue;
    }
    flushList();
    if (!line.trim()) {
      blocks.push(<div key={key++} className="h-2" />);
      continue;
    }
    blocks.push(
      <p key={key++} className="leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }
  flushList();
  return <div className="space-y-0.5">{blocks}</div>;
}

function buildFollowUps(text: string): string[] {
  const out: string[] = [];
  const invoiceMatches = text.match(/\b(INV-[A-Z0-9-]+)\b/gi) || [];
  const invoices = Array.from(new Set(invoiceMatches.map((m) => m.toUpperCase())));
  if (invoices[0]) {
    out.push(`Get details for ${invoices[0]}`);
    out.push(`Create a follow-up task for ${invoices[0]}`);
  }
  const offer = text.match(
    /would you like(?:\s+me)?\s+to\s+(.+?)\s+or\s+(.+?)(?:\?|$)/i
  );
  if (offer) {
    const a = offer[1].replace(/[?.!]+$/, '').trim();
    const b = offer[2].replace(/[?.!]+$/, '').trim();
    if (a) out.unshift(a.charAt(0).toUpperCase() + a.slice(1));
    if (b) out.unshift(b.charAt(0).toUpperCase() + b.slice(1));
  }
  if (/message|tell|notify|ping/i.test(text)) {
    out.push('Message a teammate about this');
  }
  if (/overdue|invoice/i.test(text) && !invoices.length) out.push('List overdue invoices');
  if (/ticket/i.test(text)) out.push('Show open tickets');
  return Array.from(new Set(out)).slice(0, 3);
}

function formatThreadTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

type ThreadSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  createdAt: string;
};

export function OpsAgentPanel() {
  const params = useParams<{ company?: string }>();
  const slug = typeof params?.company === 'string' ? params.company : undefined;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'chat'>('list');
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingImages, setPendingImages] = useState<ChatImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [taggedMentions, setTaggedMentions] = useState<MentionSuggestion[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headers = slug ? workspaceSlugHeaders(slug) : {};

  const closeMentions = useCallback(() => {
    setMentionOpen(false);
    setMentionSuggestions([]);
    setMentionQuery('');
    setMentionStart(null);
    setMentionIndex(0);
  }, []);

  const syncMentionsFromCaret = useCallback(
    (text: string, caret: number) => {
      const active = getActiveMention(text, caret);
      if (!active) {
        closeMentions();
        return;
      }
      setMentionOpen(true);
      setMentionStart(active.start);
      setMentionQuery(active.query);
      setMentionIndex(0);

      if (mentionTimer.current) clearTimeout(mentionTimer.current);
      mentionTimer.current = setTimeout(async () => {
        setMentionLoading(true);
        try {
          const res = await fetch(
            `/api/agent/mentions?q=${encodeURIComponent(active.query)}`,
            { headers: { ...headers } }
          );
          if (!res.ok) {
            setMentionSuggestions([]);
            return;
          }
          const data = await res.json();
          setMentionSuggestions(Array.isArray(data.results) ? data.results : []);
        } catch {
          setMentionSuggestions([]);
        } finally {
          setMentionLoading(false);
        }
      }, 120);
    },
    [closeMentions, slug]
  );

  const applyMention = useCallback(
    (suggestion: MentionSuggestion) => {
      const el = inputRef.current;
      const caret = el?.selectionStart ?? input.length;
      const start = mentionStart ?? getActiveMention(input, caret)?.start;
      if (start == null) return;

      const before = input.slice(0, start);
      const after = input.slice(caret);
      const inserted = `@${suggestion.label} `;
      const next = `${before}${inserted}${after}`;
      setInput(next);
      setTaggedMentions((prev) => {
        if (prev.some((p) => p.id === suggestion.id)) return prev;
        return [...prev, suggestion];
      });
      closeMentions();
      requestAnimationFrame(() => {
        const pos = before.length + inserted.length;
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(pos, pos);
      });
    },
    [closeMentions, input, mentionStart]
  );

  useEffect(() => {
    return () => {
      if (mentionTimer.current) clearTimeout(mentionTimer.current);
    };
  }, []);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const res = await fetch('/api/agent/chat', { headers: { ...headers } });
      if (!res.ok) return;
      const data = await res.json();
      setThreads(Array.isArray(data.threads) ? data.threads : []);
    } catch {
      /* ignore */
    } finally {
      setLoadingThreads(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!open) return;
    void fetch('/api/agent/me', { headers: { ...headers } }).catch(() => undefined);
    if (view === 'list') void loadThreads();
  }, [open, view, loadThreads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, sending, view]);

  const openThread = async (id: string) => {
    setLoadingChat(true);
    setThreadId(id);
    setView('chat');
    setMessages([]);
    try {
      const res = await fetch(`/api/agent/chat?threadId=${encodeURIComponent(id)}`, {
        headers: { ...headers },
      });
      if (!res.ok) throw new Error('Failed to load chat');
      const data = await res.json();
      const mapped: ChatMessage[] = (data.messages || []).map(
        (m: {
          id: string;
          role: string;
          content: {
            text?: string;
            localScreenshot?: boolean;
            pendingWrites?: PendingWrite[];
          };
        }) => ({
          id: m.id,
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: m.content?.text || '',
          images: m.content?.localScreenshot
            ? [{ mimeType: 'image/png', localOnlyPlaceholder: true }]
            : undefined,
          pendingWrites: m.content?.pendingWrites,
          followUps:
            m.role === 'assistant' && m.content?.text
              ? buildFollowUps(m.content.text)
              : undefined,
        })
      );
      setMessages(mapped);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open chat');
      setView('list');
    } finally {
      setLoadingChat(false);
    }
  };

  const startNewChat = () => {
    setThreadId(null);
    setMessages([]);
    setPendingImages([]);
    setTaggedMentions([]);
    setInput('');
    closeMentions();
    setView('chat');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const backToList = () => {
    setView('list');
    setPendingImages([]);
    void loadThreads();
  };

  const deleteThread = async (id: string) => {
    try {
      const res = await fetch(`/api/agent/chat?threadId=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { ...headers },
      });
      if (!res.ok) throw new Error('Delete failed');
      setThreads((t) => t.filter((x) => x.id !== id));
      if (threadId === id) {
        setThreadId(null);
        setMessages([]);
      }
      toast.success('Chat deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const addImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only images are supported');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image must be under 8MB');
      return;
    }
    if (pendingImages.length >= 4) {
      toast.error('Max 4 images per message');
      return;
    }
    setUploading(true);
    const previewUrl = URL.createObjectURL(file);
    try {
      // Local-device only — never upload screenshots to the cloud
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      if (!base64) throw new Error('empty image');
      setPendingImages((imgs) => [
        ...imgs,
        {
          mimeType: file.type || 'image/png',
          data: base64,
          previewUrl,
        },
      ]);
    } catch {
      toast.error('Could not attach screenshot');
      URL.revokeObjectURL(previewUrl);
    } finally {
      setUploading(false);
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages((imgs) => {
      const target = imgs[index];
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return imgs.filter((_, j) => j !== index);
    });
  };

  const sendMessage = async (raw: string) => {
    const message = raw.trim();
    if ((!message && !pendingImages.length) || sending) return;
    const imagesToSend = pendingImages.map(({ mimeType, data }) => ({
      mimeType,
      data,
    }));
    const previewImages = pendingImages.map(({ mimeType, previewUrl, data }) => ({
      mimeType,
      previewUrl,
      data: previewUrl ? undefined : data,
    }));
    const mentionsToSend = taggedMentions.filter((m) =>
      message.toLowerCase().includes(`@${m.label}`.toLowerCase())
    );
    setInput('');
    setPendingImages([]);
    setTaggedMentions([]);
    closeMentions();
    setSending(true);
    setMessages((m) => [
      ...m,
      {
        id: `u-${Date.now()}`,
        role: 'user',
        text: message || 'Analyze this screenshot',
        images: previewImages,
      },
    ]);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          message,
          threadId,
          images: imagesToSend,
          mentions: mentionsToSend,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Agent failed');

      setThreadId(data.threadId);
      const reply = String(data.reply || '');
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: reply,
          pendingWrites: data.pendingWrites,
          followUps: buildFollowUps(reply),
        },
      ]);
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Agent failed';
      toast.error(err);
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: err.includes('API key')
            ? 'Sorry — I could not complete that. Check your Gemini API key in Settings.'
            : `Sorry — I could not complete that.\n\n${err}`,
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const confirmWrite = async (toolRunId: string, action: 'confirm' | 'reject') => {
    try {
      const res = await fetch('/api/agent/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ toolRunId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(action === 'confirm' ? 'Action executed' : 'Action cancelled');
      setMessages((m) =>
        m.map((msg) => ({
          ...msg,
          pendingWrites: msg.pendingWrites?.filter((p) => p.toolRunId !== toolRunId),
        }))
      );
      if (action === 'confirm') {
        setMessages((m) => [
          ...m,
          {
            id: `c-${Date.now()}`,
            role: 'assistant',
            text: 'Action completed successfully.',
            followUps: ['What else needs attention?', 'Show open tickets'],
          },
        ]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Confirm failed');
    }
  };

  return (
    <>
      <Button
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg bg-teal-700 hover:bg-teal-800"
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next) setView('list');
            return next;
          });
        }}
        aria-label="Open OPS"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </Button>

      {open ? (
        <div className="fixed bottom-24 right-6 z-50 flex h-[min(580px,72vh)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <div className="flex items-center gap-2 border-b px-3 py-2.5 bg-muted/40">
            {view === 'chat' ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={backToList}
                aria-label="All chats"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-white text-[10px] font-bold tracking-wide">
                OPS
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-wide">
                {view === 'list' ? 'OPS' : 'Chat'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {view === 'list'
                  ? 'Your conversations'
                  : threads.find((t) => t.id === threadId)?.title ||
                    (threadId ? 'Conversation' : 'New chat')}
              </p>
            </div>
            {view === 'list' ? (
              <Button size="sm" className="h-8 bg-teal-700 hover:bg-teal-800" onClick={startNewChat}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                New
              </Button>
            ) : (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={startNewChat} aria-label="New chat">
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {view === 'list' ? (
            <div className="flex-1 overflow-y-auto">
              {loadingThreads ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading chats…
                </div>
              ) : threads.length === 0 ? (
                <div className="p-6 text-center space-y-3">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">No chats yet</p>
                  <Button className="bg-teal-700 hover:bg-teal-800" onClick={startNewChat}>
                    Start a chat
                  </Button>
                </div>
              ) : (
                <ul className="divide-y">
                  {threads.map((t) => (
                    <li key={t.id} className="flex items-stretch group">
                      <button
                        type="button"
                        className="flex-1 text-left px-4 py-3 hover:bg-muted/60 transition-colors min-w-0"
                        onClick={() => void openThread(t.id)}
                      >
                        <p className="text-sm font-medium truncate">
                          {t.title || 'Untitled chat'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatThreadTime(t.updatedAt)}
                        </p>
                      </button>
                      <button
                        type="button"
                        className="px-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        aria-label="Delete chat"
                        onClick={() => void deleteThread(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {loadingChat ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening chat…
                  </div>
                ) : null}

                {!loadingChat && messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground space-y-3 p-2">
                    <p>Ask OPS, type @ to tag people, or paste a screenshot.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'What is overdue today?',
                        'Show open tickets',
                        'Message Priya about the overdue invoice',
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          className="rounded-full border px-2.5 py-1 text-[11px] hover:bg-muted transition-colors"
                          onClick={() => void sendMessage(chip)}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-2">
                    <div
                      className={cn(
                        'rounded-lg px-3 py-2 text-sm',
                        msg.role === 'user'
                          ? 'ml-8 bg-teal-700 text-white'
                          : 'mr-2 bg-muted'
                      )}
                    >
                      {msg.images?.length ? (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {msg.images.map((img, i) =>
                            img.localOnlyPlaceholder ? (
                              <div
                                key={i}
                                className={cn(
                                  'flex h-16 w-24 items-center justify-center rounded-md border text-[10px] px-1 text-center',
                                  msg.role === 'user'
                                    ? 'border-white/30 text-white/80'
                                    : 'border-border text-muted-foreground'
                                )}
                              >
                                Screenshot (device only)
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={i}
                                src={
                                  img.previewUrl ||
                                  img.url ||
                                  (img.data
                                    ? `data:${img.mimeType};base64,${img.data}`
                                    : '')
                                }
                                alt="Screenshot"
                                className="max-h-28 rounded-md border border-white/20 object-cover"
                              />
                            )
                          )}
                        </div>
                      ) : null}
                      {msg.role === 'assistant' ? (
                        <AgentMarkdown text={msg.text} />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      )}

                      {msg.pendingWrites?.map((pw) => (
                        <div
                          key={pw.toolRunId}
                          className="mt-2 rounded-md border bg-background p-2 text-foreground space-y-2"
                        >
                          <p className="text-xs font-medium">{pw.toolName}</p>
                          <p className="text-[11px] text-muted-foreground">{pw.description}</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => confirmWrite(pw.toolRunId, 'confirm')}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => confirmWrite(pw.toolRunId, 'reject')}
                            >
                              <Ban className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {msg.role === 'assistant' && msg.followUps?.length && !sending ? (
                      <div className="mr-2 flex flex-wrap gap-1.5">
                        {msg.followUps.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            disabled={sending}
                            className="rounded-full border bg-background px-2.5 py-1 text-[11px] hover:bg-muted transition-colors disabled:opacity-50"
                            onClick={() => void sendMessage(chip)}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}

                {sending ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    OPS is working…
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>

              <div className="border-t p-3 space-y-2">
                {pendingImages.length ? (
                  <div className="flex flex-wrap gap-2">
                    {pendingImages.map((img, i) => (
                      <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.previewUrl || img.url}
                          alt=""
                          className="h-14 w-14 rounded-md object-cover border"
                        />
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-background border text-[10px]"
                          onClick={() => removePendingImage(i)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div
                  className="relative flex items-end gap-2 rounded-lg border bg-muted/30 px-2 py-1.5 focus-within:border-teal-700/50"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
                      f.type.startsWith('image/')
                    );
                    for (const file of files.slice(0, 4 - pendingImages.length)) {
                      void addImageFile(file);
                    }
                  }}
                >
                  {mentionOpen ? (
                    <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-50 max-h-56 overflow-y-auto rounded-lg border bg-background shadow-lg">
                      <div className="sticky top-0 border-b bg-muted/50 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Tag people & customers
                        {mentionQuery ? ` · “${mentionQuery}”` : ''}
                      </div>
                      {mentionLoading ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Searching…
                        </div>
                      ) : mentionSuggestions.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-muted-foreground">
                          No matches. Try a name or email.
                        </p>
                      ) : (
                        <ul className="py-1">
                          {mentionSuggestions.map((s, i) => {
                            const Icon = mentionTypeIcon(s.type);
                            return (
                              <li key={s.id}>
                                <button
                                  type="button"
                                  className={cn(
                                    'flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted',
                                    i === mentionIndex && 'bg-muted'
                                  )}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    applyMention(s);
                                  }}
                                  onMouseEnter={() => setMentionIndex(i)}
                                >
                                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">
                                      {s.label}
                                    </span>
                                    <span className="block truncate text-[11px] text-muted-foreground">
                                      {mentionTypeLabel(s.type)}
                                      {s.subtitle ? ` · ${s.subtitle}` : ''}
                                    </span>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void addImageFile(file);
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="mb-0.5 h-8 w-8 shrink-0"
                    disabled={uploading || sending || pendingImages.length >= 4}
                    onClick={() => fileRef.current?.click()}
                    aria-label="Attach screenshot"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                  </Button>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      const value = e.target.value;
                      setInput(value);
                      syncMentionsFromCaret(value, e.target.selectionStart ?? value.length);
                    }}
                    onClick={(e) => {
                      const t = e.currentTarget;
                      syncMentionsFromCaret(t.value, t.selectionStart ?? t.value.length);
                    }}
                    onKeyUp={(e) => {
                      if (
                        e.key === 'ArrowLeft' ||
                        e.key === 'ArrowRight' ||
                        e.key === 'Home' ||
                        e.key === 'End'
                      ) {
                        const t = e.currentTarget;
                        syncMentionsFromCaret(t.value, t.selectionStart ?? t.value.length);
                      }
                    }}
                    placeholder="Message OPS — type @ to tag people"
                    rows={2}
                    className="min-h-[44px] max-h-28 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm outline-none ring-0 focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
                    onPaste={(e) => {
                      const items = Array.from(e.clipboardData?.items || []);
                      const imageItems = items.filter((i) => i.type.startsWith('image/'));
                      if (!imageItems.length) return;
                      e.preventDefault();
                      for (const item of imageItems.slice(0, 4 - pendingImages.length)) {
                        const file = item.getAsFile();
                        if (file) void addImageFile(file);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (mentionOpen && mentionSuggestions.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setMentionIndex((i) => (i + 1) % mentionSuggestions.length);
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setMentionIndex(
                            (i) =>
                              (i - 1 + mentionSuggestions.length) %
                              mentionSuggestions.length
                          );
                          return;
                        }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault();
                          applyMention(mentionSuggestions[mentionIndex]);
                          return;
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          closeMentions();
                          return;
                        }
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage(input);
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    className="mb-0.5 h-8 w-8 shrink-0 rounded-md bg-teal-700 hover:bg-teal-800"
                    disabled={
                      sending || uploading || (!input.trim() && !pendingImages.length)
                    }
                    onClick={() => void sendMessage(input)}
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}

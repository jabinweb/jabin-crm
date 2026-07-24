'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { Bot, Loader2, Send, X, Check, Ban } from 'lucide-react';
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

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pendingWrites?: PendingWrite[];
  followUps?: string[];
};

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
  const invoices = Array.from(
    new Set(invoiceMatches.map((m) => m.toUpperCase()))
  );
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

  if (/overdue|invoice/i.test(text) && !invoices.length) {
    out.push('List overdue invoices');
  }
  if (/ticket/i.test(text)) out.push('Show open tickets');

  return Array.from(new Set(out)).slice(0, 3);
}

export function OpsAgentPanel() {
  const params = useParams<{ company?: string }>();
  const slug = typeof params?.company === 'string' ? params.company : undefined;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const headers = slug ? workspaceSlugHeaders(slug) : {};

  useEffect(() => {
    // Warm agent/models silently — no UI for model chain
    if (!open) return;
    void fetch('/api/agent/me', { headers: { ...headers } }).catch(() => undefined);
  }, [open, slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, sending]);

  const sendMessage = async (raw: string) => {
    const message = raw.trim();
    if (!message || sending) return;
    setInput('');
    setSending(true);
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: 'user', text: message },
    ]);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ message, threadId }),
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
            followUps: ['What else is overdue?', 'Show open tickets'],
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
        onClick={() => setOpen((o) => !o)}
        aria-label="Open OPS"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </Button>

      {open ? (
        <div className="fixed bottom-24 right-6 z-50 flex h-[min(560px,70vh)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <div className="flex items-center gap-2 border-b px-4 py-3 bg-muted/40">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-white text-xs font-bold tracking-wide">
              OPS
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide">OPS</p>
              <p className="text-[11px] text-muted-foreground">Company ops assistant</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-3 p-2">
                <p>Ask OPS to run the company.</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'What is overdue today?',
                    'Show open tickets',
                    'Search customer Fortis',
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
                      ? 'ml-8 bg-teal-700 text-white whitespace-pre-wrap'
                      : 'mr-2 bg-muted'
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <AgentMarkdown text={msg.text} />
                  ) : (
                    msg.text
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
                        className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-foreground hover:bg-muted transition-colors disabled:opacity-50"
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

          <div className="border-t p-3">
            <div className="flex items-end gap-2 rounded-lg border bg-muted/30 px-2 py-1.5 focus-within:border-teal-700/50">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message OPS…"
                rows={2}
                className="min-h-[44px] max-h-28 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm outline-none ring-0 focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
              />
              <Button
                size="icon"
                className="mb-0.5 h-8 w-8 shrink-0 rounded-md bg-teal-700 hover:bg-teal-800"
                disabled={sending || !input.trim()}
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
        </div>
      ) : null}
    </>
  );
}

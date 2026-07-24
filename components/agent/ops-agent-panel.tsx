'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Bot, Loader2, Send, X, Check, Ban, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  modelUsed?: string;
};

export function OpsAgentPanel() {
  const params = useParams<{ company?: string }>();
  const slug = typeof params?.company === 'string' ? params.company : undefined;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [agentName, setAgentName] = useState('Ops Agent');
  const [modelChain, setModelChain] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const headers = slug ? workspaceSlugHeaders(slug) : {};

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await fetch('/api/agent/me', { headers: { ...headers } });
        if (!res.ok) return;
        const data = await res.json();
        if (data.agent?.name) setAgentName(data.agent.name);
        if (Array.isArray(data.chain)) setModelChain(data.chain.slice(0, 4));
      } catch {
        /* ignore */
      }
    })();
  }, [open, slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const message = input.trim();
    if (!message || sending) return;
    setInput('');
    setSending(true);
    const tempId = `u-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: 'user', text: message }]);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ message, threadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Agent failed');

      setThreadId(data.threadId);
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          pendingWrites: data.pendingWrites,
          modelUsed: data.modelUsed,
        },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Agent failed');
      setMessages((m) => [
        ...m,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: 'Sorry — I could not complete that. Check your Gemini API key in Settings.',
        },
      ]);
    } finally {
      setSending(false);
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
      if (action === 'confirm' && data.result) {
        setMessages((m) => [
          ...m,
          {
            id: `c-${Date.now()}`,
            role: 'assistant',
            text: 'Action completed successfully.',
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
        aria-label="Open Ops Agent"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </Button>

      {open ? (
        <div className="fixed bottom-24 right-6 z-50 flex h-[min(560px,70vh)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/40">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-700" />
                <p className="text-sm font-semibold">{agentName}</p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Company ops · writes need confirm
              </p>
            </div>
            {modelChain[0] ? (
              <Badge variant="outline" className="text-[10px] font-normal max-w-[140px] truncate">
                {modelChain[0]}
              </Badge>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-2 p-2">
                <p>Ask me to run the company:</p>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  <li>What is overdue today?</li>
                  <li>Show open tickets</li>
                  <li>Search customer Acme</li>
                  <li>Create a task to follow up…</li>
                </ul>
              </div>
            ) : null}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'ml-8 bg-teal-700 text-white'
                    : 'mr-4 bg-muted'
                )}
              >
                {msg.text}
                {msg.modelUsed && msg.role === 'assistant' ? (
                  <p className="mt-1 text-[10px] opacity-60">via {msg.modelUsed}</p>
                ) : null}
                {msg.pendingWrites?.map((pw) => (
                  <div
                    key={pw.toolRunId}
                    className="mt-2 rounded-md border bg-background p-2 text-foreground space-y-2"
                  >
                    <p className="text-xs font-medium">{pw.toolName}</p>
                    <p className="text-[11px] text-muted-foreground">{pw.description}</p>
                    <pre className="text-[10px] overflow-x-auto max-h-20 bg-muted/50 p-1 rounded">
                      {JSON.stringify(pw.args, null, 0)}
                    </pre>
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
            ))}
            {sending ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking with fallback models…
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t p-3 flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your company agent…"
              rows={2}
              className="min-h-[60px] resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button
              size="icon"
              className="shrink-0 bg-teal-700 hover:bg-teal-800"
              disabled={sending || !input.trim()}
              onClick={() => void send()}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

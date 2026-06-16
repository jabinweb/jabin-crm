'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { getClientBrandConfig } from '@/lib/branding';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'live_chat_visitor_token';

export function LiveChatWidget({ companyId }: { companyId?: string }) {
  const brand = getClientBrandConfig();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; sender: string; body: string; createdAt: string }>>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    fetch(`/api/support/chat/enabled${params}`)
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => setEnabled(data.enabled === true))
      .catch(() => setEnabled(false));
  }, [companyId]);

  useEffect(() => {
    if (enabled !== true) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    setVisitorToken(stored);
    (async () => {
      try {
        const res = await fetch('/api/support/chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorToken: stored, companyId }),
        });
        if (!res.ok) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        const data = await res.json();
        setSessionId(data.id);
        setVisitorName(data.visitorName ?? '');
        setVisitorEmail(data.visitorEmail ?? '');
        setMessages(data.messages ?? []);
        setStarted(true);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    })();
  }, [enabled, companyId]);

  useEffect(() => {
    if (enabled !== true) return;
    if (!sessionId || !visitorToken) return;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/support/chat/sessions/${sessionId}?visitorToken=${encodeURIComponent(visitorToken)}`
        );
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
        }
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [sessionId, visitorToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startChat = async () => {
    if (!visitorName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/support/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorToken: visitorToken ?? undefined,
          visitorName: visitorName.trim(),
          visitorEmail: visitorEmail.trim() || undefined,
          companyId,
        }),
      });
      if (!res.ok) throw new Error('Failed to start');
      const data = await res.json();
      setSessionId(data.id);
      setVisitorToken(data.visitorToken);
      localStorage.setItem(STORAGE_KEY, data.visitorToken);
      setMessages(data.messages ?? []);
      setStarted(true);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!draft.trim() || !sessionId || !visitorToken) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft.trim(), visitorToken }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        setDraft('');
      }
    } finally {
      setSending(false);
    }
  };

  if (enabled === false || enabled === null) {
    return null;
  }

  return (
    <>
      {!open && (
        <Button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          style={{ backgroundColor: brand.primaryColor }}
          onClick={() => setOpen(true)}
          aria-label="Open live chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 w-[360px] max-w-[calc(100vw-2rem)] h-[480px] bg-background border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: brand.primaryColor }}
          >
            <div>
              <p className="font-semibold text-sm">{brand.appName} Support</p>
              <p className="text-xs opacity-90">We typically reply within minutes</p>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {!started ? (
            <div className="p-4 space-y-3 flex-1">
              <p className="text-sm text-muted-foreground">Start a conversation with our team.</p>
              <Input placeholder="Your name" value={visitorName} onChange={(e) => setVisitorName(e.target.value)} />
              <Input placeholder="Email (optional)" type="email" value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} />
              <Button className="w-full" onClick={startChat} disabled={loading || !visitorName.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start chat'}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Say hello — an agent will join shortly.</p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                      m.sender === 'visitor' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-background border'
                    )}
                  >
                    {m.body}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t flex gap-2">
                <Textarea
                  placeholder="Type a message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-[44px] max-h-24 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button size="icon" onClick={sendMessage} disabled={sending || !draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

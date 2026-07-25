'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { SupportBackLink } from '@/components/support/support-back-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { MessageCircle, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CardListSkeleton } from '@/components/loading';
import { DashboardLink } from '@/components/navigation/dashboard-link';

type ChatMessage = {
  id: string;
  sender: string;
  body: string;
  createdAt: string;
};

type ChatSession = {
  id: string;
  visitorName?: string | null;
  visitorEmail?: string | null;
  status: string;
  updatedAt: string;
  ticketId?: string | null;
  customer?: { organizationName?: string | null; contactPerson?: string | null } | null;
  ticket?: { id: string; subject: string; status: string } | null;
  messages?: ChatMessage[];
};

export default function LiveChatDeskPage() {
  return (
    <FeatureModuleGuard module="SUPPORT_LIVE_CHAT" title="Live chat requires an upgrade">
      <LiveChatDesk />
    </FeatureModuleGuard>
  );
}

function LiveChatDesk() {
  const { workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const sessionFromUrl = searchParams.get('session');
  const [selectedId, setSelectedId] = useState<string | null>(sessionFromUrl);
  const [reply, setReply] = useState('');

  useEffect(() => {
    if (sessionFromUrl) setSelectedId(sessionFromUrl);
  }, [sessionFromUrl]);

  const { data, isLoading } = useQuery({
    queryKey: ['live-chat-sessions'],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/chat/sessions');
      if (!res.ok) throw new Error('Failed to load sessions');
      return (await res.json()) as { sessions: ChatSession[] };
    },
    refetchInterval: 8_000,
  });

  const sessions = data?.sessions ?? [];

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['live-chat-session', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const res = await workspaceFetch(`/api/support/chat/sessions/${selectedId}`);
      if (!res.ok) throw new Error('Failed to load session');
      return (await res.json()) as ChatSession;
    },
    refetchInterval: 4_000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId || !reply.trim()) return;
      const res = await workspaceFetch(`/api/support/chat/sessions/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send');
      }
    },
    onSuccess: () => {
      setReply('');
      void queryClient.invalidateQueries({ queryKey: ['live-chat-session', selectedId] });
      void queryClient.invalidateQueries({ queryKey: ['live-chat-sessions'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = useMemo(
    () => sessions.find((s) => s.id === selectedId) || detail || null,
    [sessions, selectedId, detail]
  );

  const messages = detail?.messages ?? [];

  return (
    <div className="space-y-4">
      <SupportBackLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Live chat</h1>
        <p className="text-sm text-muted-foreground">
          Answer open visitor chats from your website or portal widget.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] min-h-[520px]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Open sessions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4">
                <CardListSkeleton rows={4} />
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground space-y-2">
                <MessageCircle className="mx-auto h-8 w-8 opacity-50" />
                <p>No open chats</p>
              </div>
            ) : (
              <ScrollArea className="h-[480px]">
                <div className="divide-y">
                  {sessions.map((session) => {
                    const title =
                      session.visitorName ||
                      session.customer?.contactPerson ||
                      session.visitorEmail ||
                      'Visitor';
                    const preview = session.messages?.[0]?.body;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedId(session.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/50 ${
                          selectedId === session.id ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm truncate">{title}</p>
                          <Badge variant="secondary" className="shrink-0">
                            {session.status}
                          </Badge>
                        </div>
                        {preview && (
                          <p className="text-xs text-muted-foreground truncate mt-1">{preview}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-[520px]">
          {!selectedId ? (
            <CardContent className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a chat to reply
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b space-y-1">
                <CardTitle className="text-base">
                  {selected?.visitorName ||
                    selected?.customer?.organizationName ||
                    selected?.visitorEmail ||
                    'Visitor'}
                </CardTitle>
                {selected?.ticketId && (
                  <DashboardLink
                    href={`/dashboard/tickets/${selected.ticketId}`}
                    className="text-xs underline underline-offset-2 text-muted-foreground"
                  >
                    Open linked ticket
                  </DashboardLink>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 px-4 py-3 h-[360px]">
                  {detailLoading && messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
                            m.sender === 'agent'
                              ? 'ml-auto bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p>{m.body}</p>
                          <p className="text-[10px] opacity-70 mt-1">
                            {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <div className="border-t p-3 flex gap-2">
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type a reply…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMutation.mutate();
                      }
                    }}
                  />
                  <Button
                    onClick={() => sendMutation.mutate()}
                    disabled={sendMutation.isPending || !reply.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, Inbox, Mail, MessageCircle, Phone, Globe, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { FeatureModuleGuard } from '@/components/feature-module-guard';

const CHANNELS = [
  { id: 'all', label: 'All', icon: Inbox },
  { id: 'EMAIL', label: 'Email', icon: Mail },
  { id: 'CHAT', label: 'Chat', icon: MessageCircle },
  { id: 'PORTAL', label: 'Portal', icon: Globe },
  { id: 'PHONE', label: 'Phone', icon: Phone },
  { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle },
] as const;

const channelBadge = (ch: string) => {
  const colors: Record<string, string> = {
    EMAIL: 'bg-blue-100 text-blue-800',
    CHAT: 'bg-purple-100 text-purple-800',
    PORTAL: 'bg-green-100 text-green-800',
    PHONE: 'bg-amber-100 text-amber-800',
    WHATSAPP: 'bg-emerald-100 text-emerald-800',
  };
  return colors[ch] ?? 'bg-muted text-muted-foreground';
};

export default function OmnichannelInboxPage() {
  const [channel, setChannel] = useState('all');
  const [search, setSearch] = useState('');

  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['inbox-tickets', channel],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (channel !== 'all') params.set('channel', channel);
      const res = await fetch(`/api/tickets?${params}`);
      if (!res.ok) throw new Error('Failed to load tickets');
      return res.json();
    },
  });

  const { data: chatData } = useQuery({
    queryKey: ['inbox-chats'],
    queryFn: async () => {
      const res = await fetch('/api/support/chat/sessions');
      if (!res.ok) return { sessions: [] };
      return res.json();
    },
    refetchInterval: 10000,
  });

  const filtered = tickets?.filter(
    (t: { subject: string; customer: { organizationName: string } }) =>
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.customer.organizationName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <FeatureModuleGuard module="SUPPORT_INBOX">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/dashboard/support">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Support desk
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Omnichannel inbox</h1>
          <p className="text-muted-foreground mt-1">
            Unified queue across email, chat, portal, phone, and WhatsApp.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/tickets/new">New ticket</Link>
        </Button>
      </div>

      <Tabs value={channel} onValueChange={setChannel}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {CHANNELS.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="gap-1.5">
              <c.icon className="h-3.5 w-3.5" />
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={channel} className="space-y-4 mt-4">
          <Input
            placeholder="Search subject or account…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />

          {channel === 'CHAT' && (chatData?.sessions?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active live chats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {chatData.sessions.map((s: {
                  id: string;
                  visitorName: string | null;
                  visitorEmail: string | null;
                  updatedAt: string;
                  ticket: { id: string } | null;
                  messages: Array<{ body: string }>;
                }) => (
                  <Link
                    key={s.id}
                    href={s.ticket ? `/dashboard/tickets/${s.ticket.id}` : '#'}
                    className="block p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{s.visitorName || 'Visitor'}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {s.messages[0]?.body ?? 'No messages yet'}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {ticketsLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          No tickets in this channel.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered?.map((t: {
                        id: string;
                        channel: string;
                        subject: string;
                        status: string;
                        priority: string;
                        customer: { organizationName: string };
                        assignedTechnician: { name: string } | null;
                      }) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <Badge className={channelBadge(t.channel)} variant="secondary">
                              {t.channel}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">{t.subject}</TableCell>
                          <TableCell>{t.customer.organizationName}</TableCell>
                          <TableCell>{t.status}</TableCell>
                          <TableCell>{t.priority}</TableCell>
                          <TableCell>{t.assignedTechnician?.name ?? '—'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/dashboard/tickets/${t.id}`}>Open</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </FeatureModuleGuard>
  );
}

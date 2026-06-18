'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Inbox,
  Mail,
  MessageCircle,
  Phone,
  Globe,
  Loader2,
  Circle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { InboxReplySheet } from '@/components/support/inbox-reply-sheet';
import { SupportBackLink } from '@/components/support/support-back-link';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import type { UnifiedInboxItem } from '@/lib/support/unified-inbox';

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
  const { path, workspaceFetch } = useWorkspacePaths();
  const [channel, setChannel] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<UnifiedInboxItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['unified-inbox', channel, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (channel !== 'all') params.set('channel', channel);
      if (search.trim()) params.set('q', search.trim());
      const res = await workspaceFetch(`/api/support/inbox?${params}`);
      if (!res.ok) throw new Error('Failed to load inbox');
      return res.json();
    },
    refetchInterval: 15000,
  });

  const items: UnifiedInboxItem[] = data?.items ?? [];
  const counts = data?.channelCounts ?? {};

  const openItem = (item: UnifiedInboxItem) => {
    if (item.ticketId) {
      setSelectedItem(item);
      setSheetOpen(true);
      return;
    }
    if (item.type === 'chat') {
      window.location.href = `${path('/dashboard/support/inbox')}?chat=${item.id}`;
    }
  };

  return (
    <FeatureModuleGuard module="SUPPORT_INBOX">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <SupportBackLink />
            <h1 className="text-3xl font-bold tracking-tight">Omnichannel inbox</h1>
            <p className="text-muted-foreground mt-1">
              One queue for tickets, live chat, and WhatsApp — click a ticket to reply inline.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
            </Button>
            <Button asChild>
              <Link href={path('/dashboard/tickets/new')}>New ticket</Link>
            </Button>
          </div>
        </div>

        <Tabs value={channel} onValueChange={setChannel}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {CHANNELS.map((c) => (
              <TabsTrigger key={c.id} value={c.id} className="gap-1.5">
                <c.icon className="h-3.5 w-3.5" />
                {c.label}
                {counts[c.id] != null && counts[c.id] > 0 ? (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {counts[c.id]}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={channel} className="space-y-4 mt-4">
            <Input
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Conversations</CardTitle>
                <CardDescription>
                  {items.length} item{items.length === 1 ? '' : 's'} — sorted by most recent activity
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y">
                {isLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground">No conversations in this channel.</p>
                ) : (
                  items.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onClick={() => openItem(item)}
                      className="w-full flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="mt-1">
                        {item.unread ? (
                          <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
                        ) : (
                          <div className="h-2.5 w-2.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={channelBadge(item.channel)} variant="secondary">
                            {item.channel}
                          </Badge>
                          {item.type !== 'ticket' ? (
                            <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                          ) : null}
                          {item.priority ? (
                            <Badge variant="outline" className="text-[10px]">{item.priority}</Badge>
                          ) : null}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="font-medium truncate">{item.subject}</p>
                        <p className="text-sm text-muted-foreground truncate">{item.preview}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{item.customerName}</span>
                          <span>{item.status}</span>
                          {item.agentName ? <span>→ {item.agentName}</span> : null}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <InboxReplySheet
          item={selectedItem}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />
      </div>
    </FeatureModuleGuard>
  );
}

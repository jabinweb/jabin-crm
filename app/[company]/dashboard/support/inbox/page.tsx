'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { humanizeEnum, ENUM_LABEL_OVERRIDES } from '@/lib/humanize-enum';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { InboxReplySheet } from '@/components/support/inbox-reply-sheet';
import { SupportBackLink } from '@/components/support/support-back-link';
import { CardListSkeleton } from '@/components/loading';
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
    EMAIL: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    CHAT: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
    PORTAL: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    PHONE: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    WHATSAPP: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  };
  return colors[ch] ?? 'bg-muted text-muted-foreground';
};

export default function OmnichannelInboxPage() {
  const router = useRouter();
  const { path, workspaceFetch } = useWorkspacePaths();
  const [channel, setChannel] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<UnifiedInboxItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
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
      const sessionId = item.sessionId || item.id;
      router.push(`${path('/dashboard/support/live-chat')}?session=${encodeURIComponent(sessionId)}`);
      return;
    }
    if (item.type === 'whatsapp' && item.chatKey) {
      router.push(
        `${path('/dashboard/whatsapp')}?chat=${encodeURIComponent(item.chatKey)}`
      );
      return;
    }
    toast.info('Open the WhatsApp or Live chat desk to continue this conversation.');
  };

  return (
    <FeatureModuleGuard module="SUPPORT_INBOX">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <SupportBackLink />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Omnichannel inbox</h1>
            <p className="text-muted-foreground mt-1">
              One queue for tickets, live chat, and WhatsApp — tickets open inline; unticketed
              chats go to Live chat or WhatsApp.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
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
              type="search"
              aria-label="Search conversations"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-md"
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
                  <div className="p-4">
                    <CardListSkeleton rows={6} />
                  </div>
                ) : isError ? (
                  <EmptyState
                    icon={AlertTriangle}
                    title="Couldn't load the inbox"
                    description="Check your connection and try again."
                    actionLabel="Try again"
                    onAction={() => refetch()}
                  />
                ) : items.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title={search.trim() ? 'No matching conversations' : 'No conversations here yet'}
                    description={
                      search.trim()
                        ? 'Try a different search or switch channel.'
                        : 'New tickets, chats, and WhatsApp messages will appear here as they arrive.'
                    }
                    actionLabel={search.trim() ? undefined : 'New ticket'}
                    actionHref={search.trim() ? undefined : path('/dashboard/tickets/new')}
                  />
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
                            {humanizeEnum(item.channel, ENUM_LABEL_OVERRIDES)}
                          </Badge>
                          {item.type !== 'ticket' ? (
                            <Badge variant="outline" className="text-[10px]">{humanizeEnum(item.type, ENUM_LABEL_OVERRIDES)}</Badge>
                          ) : null}
                          {item.priority ? (
                            <Badge variant="outline" className="text-[10px]">{humanizeEnum(item.priority)} priority</Badge>
                          ) : null}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="font-medium truncate">{item.subject}</p>
                        <p className="text-sm text-muted-foreground truncate">{item.preview}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="truncate">{item.customerName}</span>
                          <span>{humanizeEnum(item.status)}</span>
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

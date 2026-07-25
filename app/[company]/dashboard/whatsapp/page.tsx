'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import {
  Check,
  ChevronDown,
  Filter,
  Link2,
  Loader2,
  MessageSquare,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  cacheWhatsAppMessages,
  mergeCachedWithServer,
  readCachedWhatsAppMessages,
  type CachedWaMessage,
} from '@/lib/whatsapp/local-store';
import { normalizeWhatsAppChatJid } from '@/lib/crm/whatsapp-chat';

type WaMessage = {
  id: string;
  createdAt: string;
  direction: string;
  status: string;
  message: string;
  channel?: string;
  chatJid?: string;
  isGroup?: boolean;
  senderName?: string | null;
  fromPhone?: string | null;
  toPhone?: string | null;
};

type ChatThread = {
  key: string;
  label: string;
  isGroup: boolean;
  lastMessage: WaMessage;
  messages: WaMessage[];
  preview: string;
};

function initials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (label.slice(0, 2) || '?').toUpperCase();
}

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'dd MMM HH:mm');
}

function connectionTone(status?: string) {
  if (status === 'ACTIVE') return 'bg-emerald-500';
  if (
    status === 'SYNCING' ||
    status === 'CONNECTING' ||
    status === 'INITIALIZING'
  ) {
    return 'bg-amber-500 animate-pulse';
  }
  return 'bg-muted-foreground/40';
}

function statusLabel(status?: string) {
  if (!status) return 'Unknown';
  if (status === 'ACTIVE') return 'Connected';
  if (status === 'SYNCING') return 'Syncing';
  if (status === 'CONNECTING') return 'Scan QR';
  if (status === 'INITIALIZING') return 'Starting…';
  if (status === 'DISCONNECTED') return 'Disconnected';
  return status;
}

export default function WhatsAppHubPage() {
  const { data: session } = useSession();
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [chatHasMore, setChatHasMore] = useState(false);
  const [mainTab, setMainTab] = useState('inbox');
  const [chatSearch, setChatSearch] = useState('');
  const [selectedChatKey, setSelectedChatKey] = useState<string | null>(null);
  const [linkIdsOpen, setLinkIdsOpen] = useState(false);
  const [summoraSession, setSummoraSession] = useState<{
    status: string;
    qr: string | null;
    hasQr: boolean;
    workspaceSlug?: string;
    hint?: string;
  } | null>(null);
  const [summoraBusy, setSummoraBusy] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'GROUPS_ONLY' | 'CUSTOM'>('ALL');
  const [allowedJids, setAllowedJids] = useState<string[]>([]);
  const [groups, setGroups] = useState<{ jid: string; name: string }[]>([]);
  const [filterBusy, setFilterBusy] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [config, setConfig] = useState({
    provider: 'DISABLED',
    isActive: false,
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioFromNumber: '',
    metaAccessToken: '',
    metaPhoneNumberId: '',
    metaBusinessId: '',
    metaApiVersion: 'v22.0',
    summoraBaseUrl: '',
    summoraApiKey: '',
    webhookVerifyToken: '',
  });

  const [form, setForm] = useState({
    toPhone: '',
    message: '',
    channel: 'SERVICE',
    leadId: '',
    customerId: '',
    ticketId: '',
  });

  const checkFeatureEnabled = async () => {
    try {
      const featureRes = await fetch('/api/features/me');
      if (!featureRes.ok) return true;
      const featureData = await featureRes.json();
      const enabled = featureData?.modules?.WHATSAPP === true;
      setFeatureEnabled(enabled);
      return enabled;
    } catch {
      return true;
    }
  };

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/whatsapp/config');
      if (!res.ok) throw new Error('Failed to load config');
      const data = await res.json();
      setConfig({
        provider: data.provider || 'DISABLED',
        isActive: !!data.isActive,
        twilioAccountSid: data.twilioAccountSid || '',
        twilioAuthToken: data.hasTwilioAuthToken ? '••••••••' : '',
        twilioFromNumber: data.twilioFromNumber || '',
        metaAccessToken: data.hasMetaAccessToken ? '••••••••' : '',
        metaPhoneNumberId: data.metaPhoneNumberId || '',
        metaBusinessId: data.metaBusinessId || '',
        metaApiVersion: data.metaApiVersion || 'v22.0',
        summoraBaseUrl: data.summoraBaseUrl || '',
        summoraApiKey: data.hasSummoraApiKey ? '••••••••' : '',
        webhookVerifyToken: data.hasWebhookVerifyToken ? '••••••••' : '',
      });
    } catch {
      toast.error('Failed to load WhatsApp provider config');
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Provider settings saved');
      await loadConfig();
    } catch {
      toast.error('Failed to save provider config');
    } finally {
      setSavingConfig(false);
    }
  };

  const mergeMessageLists = (a: WaMessage[], b: WaMessage[]) => {
    const byId = new Map<string, WaMessage>();
    for (const m of a) byId.set(m.id, m);
    for (const m of b) byId.set(m.id, m);
    return Array.from(byId.values()).sort(
      (x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()
    );
  };

  const applyInboxMeta = (data: {
    inboxFilter?: { filterType?: string; allowedJids?: string[] };
  }) => {
    if (!data?.inboxFilter?.filterType) return;
    const next = String(data.inboxFilter.filterType).toUpperCase();
    setFilterType(next === 'GROUPS_ONLY' || next === 'CUSTOM' ? next : 'ALL');
    if (Array.isArray(data.inboxFilter.allowedJids)) {
      setAllowedJids(data.inboxFilter.allowedJids);
    }
  };

  const loadMessages = async (channel = channelFilter, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const userId = session?.user?.id;
    try {
      if (userId && !opts?.silent) {
        const cached = await readCachedWhatsAppMessages(userId, { limit: 500 });
        if (cached.length) setMessages(cached as WaMessage[]);
      }

      const params = new URLSearchParams();
      if (channel !== 'ALL') params.append('channel', channel);
      params.set('limit', '150');
      const res = await fetch(`/api/whatsapp/messages?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      const list = (Array.isArray(data) ? data : data.messages ?? []) as WaMessage[];
      applyInboxMeta(data);
      setChatHasMore(!!data.hasMore);

      if (userId) {
        const merged = await mergeCachedWithServer(
          userId,
          list.map((m) => ({ ...m, userId })) as CachedWaMessage[]
        );
        setMessages(merged as WaMessage[]);
      } else {
        setMessages(list);
      }
    } catch {
      if (!opts?.silent) toast.error('Failed to load WhatsApp history');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const loadOlderForChat = async (chatKey: string) => {
    const key = normalizeWhatsAppChatJid(chatKey);
    const threadMsgs = messages.filter(
      (m) =>
        normalizeWhatsAppChatJid(m.chatJid || m.fromPhone || m.toPhone || '') === key
    );
    if (!threadMsgs.length) return;
    const oldest = threadMsgs.reduce((a, b) =>
      new Date(a.createdAt) < new Date(b.createdAt) ? a : b
    );
    setLoadingOlder(true);
    try {
      const params = new URLSearchParams({
        chatJid: chatKey,
        before: oldest.createdAt,
        limit: '50',
      });
      if (channelFilter !== 'ALL') params.set('channel', channelFilter);
      const res = await fetch(`/api/whatsapp/messages?${params}`);
      if (!res.ok) throw new Error('Failed to load older messages');
      const data = await res.json();
      const list = (data.messages ?? []) as WaMessage[];
      setChatHasMore(!!data.hasMore);
      if (!list.length) {
        setChatHasMore(false);
        return;
      }
      const merged = mergeMessageLists(messages, list);
      setMessages(merged);
      const userId = session?.user?.id;
      if (userId) {
        await cacheWhatsAppMessages(
          userId,
          list.map((m) => ({ ...m, userId })) as CachedWaMessage[]
        );
      }
    } catch {
      toast.error('Could not load older messages');
    } finally {
      setLoadingOlder(false);
    }
  };

  const refreshSummoraSession = async () => {
    const res = await fetch('/api/whatsapp/summora/session', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load session');
    setSummoraSession({
      status: data.status || 'UNKNOWN',
      qr: data.qr || null,
      hasQr: !!data.hasQr || !!data.qr,
      workspaceSlug: data.workspaceSlug,
      hint: typeof data.hint === 'string' ? data.hint : undefined,
    });
    return data;
  };

  const startSummoraConnect = async (force = false) => {
    setSummoraBusy(true);
    try {
      const res = await fetch('/api/whatsapp/summora/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', force }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to start WhatsApp link');
      setSummoraSession({
        status: data.status || 'CONNECTING',
        qr: data.qr || null,
        hasQr: !!data.qr,
        workspaceSlug: data.workspaceSlug,
        hint: typeof data.hint === 'string' ? data.hint : undefined,
      });
      toast.success(
        data.qr
          ? 'Scan the QR with WhatsApp on your phone'
          : 'Starting WhatsApp — QR should appear shortly'
      );
      setMainTab('setup');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not start WhatsApp connection');
    } finally {
      setSummoraBusy(false);
    }
  };

  const disconnectSummora = async () => {
    setSummoraBusy(true);
    try {
      const res = await fetch('/api/whatsapp/summora/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect');
      setSummoraSession({
        status: 'DISCONNECTED',
        qr: null,
        hasQr: false,
        workspaceSlug: data.workspaceSlug,
      });
      toast.success('WhatsApp disconnected');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not disconnect');
    } finally {
      setSummoraBusy(false);
    }
  };

  const loadSummoraFilters = async () => {
    const res = await fetch('/api/whatsapp/summora/filters', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load filters');
    const next = String(data.filterType || 'ALL').toUpperCase();
    setFilterType(next === 'GROUPS_ONLY' || next === 'CUSTOM' ? next : 'ALL');
    setAllowedJids(Array.isArray(data.allowedJids) ? data.allowedJids : []);
    return data;
  };

  const loadSummoraGroups = async () => {
    setGroupsError(null);
    const res = await fetch('/api/whatsapp/summora/groups', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) {
      setGroupsError('Too many requests — wait a few seconds and refresh groups');
      setGroups([]);
      return;
    }
    if (!res.ok) {
      setGroupsError(data.error || 'Failed to load groups');
      setGroups([]);
      return;
    }
    if (data.error === 'WHATSAPP_NOT_CONNECTED') {
      setGroupsError('WhatsApp is still connecting — refresh groups once sync settles');
      setGroups([]);
      return;
    }
    setGroups(Array.isArray(data.groups) ? data.groups : []);
  };

  const saveSummoraFilters = async (
    nextType: 'ALL' | 'GROUPS_ONLY' | 'CUSTOM',
    nextJids = allowedJids
  ) => {
    setFilterBusy(true);
    try {
      const res = await fetch('/api/whatsapp/summora/filters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterType: nextType,
          allowedJids: nextType === 'CUSTOM' ? nextJids : [],
          bridgePassthrough: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save filters');
      setFilterType(nextType);
      setAllowedJids(nextType === 'CUSTOM' ? nextJids : []);
      toast.success('Inbox filter saved');
      await loadMessages();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not save filter');
    } finally {
      setFilterBusy(false);
    }
  };

  const toggleGroupJid = (jid: string) => {
    setAllowedJids((prev) =>
      prev.includes(jid) ? prev.filter((j) => j !== jid) : [...prev, jid]
    );
  };

  useEffect(() => {
    const init = async () => {
      const enabled = await checkFeatureEnabled();
      if (!enabled) {
        setLoading(false);
        return;
      }
      await loadConfig();
      await loadMessages();
    };
    init();
  }, []);

  // Keep inbox fresh like WhatsApp Web
  useEffect(() => {
    if (mainTab !== 'inbox' || !featureEnabled) return;
    const id = setInterval(() => {
      void loadMessages(channelFilter, { silent: true });
    }, 8000);
    return () => clearInterval(id);
  }, [mainTab, featureEnabled, channelFilter, session?.user?.id]);

  useEffect(() => {
    setChatHasMore(true);
  }, [selectedChatKey]);

  useEffect(() => {
    if (config.provider !== 'SUMMORA' || !config.isActive) {
      setSummoraSession(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        if (!cancelled) await refreshSummoraSession();
      } catch {
        /* ignore */
      }
    };
    void tick();
    const status = summoraSession?.status;
    const intervalMs =
      status === 'CONNECTING' || status === 'UNKNOWN' || !status
        ? 4000
        : status === 'SYNCING'
          ? 8000
          : 15000;
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [config.provider, config.isActive, summoraSession?.status]);

  useEffect(() => {
    if (config.provider !== 'SUMMORA' || !config.isActive) return;
    void loadSummoraFilters().catch(() => undefined);
  }, [config.provider, config.isActive]);

  useEffect(() => {
    if (config.provider !== 'SUMMORA' || !config.isActive) return;
    if (filterType !== 'CUSTOM') return;
    const ready =
      summoraSession?.status === 'ACTIVE' || summoraSession?.status === 'SYNCING';
    if (!ready) return;
    void loadSummoraGroups();
  }, [config.provider, config.isActive, filterType, summoraSession?.status]);

  const threads: ChatThread[] = useMemo(() => {
    const map = new Map<string, WaMessage[]>();
    for (const msg of messages) {
      const key =
        msg.chatJid ||
        msg.fromPhone ||
        msg.toPhone ||
        msg.id;
      const list = map.get(key) || [];
      list.push(msg);
      map.set(key, list);
    }
    const result: ChatThread[] = [];
    for (const [key, msgs] of Array.from(map.entries())) {
      const sorted = [...msgs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const last = sorted[sorted.length - 1];
      const isGroup =
        last.isGroup ||
        String(key).endsWith('@g.us') ||
        sorted.some((m) => m.isGroup);
      const groupName = groups.find((g) => g.jid === key)?.name;
      const label =
        groupName ||
        (isGroup ? key.replace(/@g\.us$/, '') : null) ||
        last.senderName ||
        key;
      result.push({
        key,
        label,
        isGroup,
        lastMessage: last,
        messages: sorted,
        preview: last.message,
      });
    }
    return result.sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime()
    );
  }, [messages, groups]);

  const filteredThreads = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q)
    );
  }, [threads, chatSearch]);

  useEffect(() => {
    if (!selectedChatKey && filteredThreads[0]) {
      setSelectedChatKey(filteredThreads[0].key);
    } else if (
      selectedChatKey &&
      filteredThreads.length > 0 &&
      !filteredThreads.some((t) => t.key === selectedChatKey)
    ) {
      setSelectedChatKey(filteredThreads[0].key);
    }
  }, [filteredThreads, selectedChatKey]);

  const activeThread = filteredThreads.find((t) => t.key === selectedChatKey) || null;

  useEffect(() => {
    if (!activeThread) return;
    if (activeThread.isGroup) {
      setForm((f) => ({ ...f, toPhone: activeThread.key }));
    } else {
      const phone = activeThread.key.replace(/@s\.whatsapp\.net$/, '');
      setForm((f) => ({ ...f, toPhone: phone.startsWith('+') ? phone : phone }));
    }
  }, [activeThread?.key]);

  const sendWhatsApp = async () => {
    if (!form.toPhone || !form.message) {
      toast.error('Recipient and message are required');
      return;
    }
    const text = form.message;
    const optimisticId = `local_${Date.now()}`;
    const chatJid = normalizeWhatsAppChatJid(form.toPhone);
    const optimistic: WaMessage = {
      id: optimisticId,
      createdAt: new Date().toISOString(),
      direction: 'OUTBOUND',
      status: 'QUEUED',
      message: text,
      channel: form.channel,
      chatJid,
      isGroup: chatJid.endsWith('@g.us'),
      senderName: 'You',
      toPhone: form.toPhone,
      fromPhone: chatJid,
    };
    setMessages((prev) => mergeMessageLists(prev, [optimistic]));
    setForm((f) => ({ ...f, message: '', leadId: '', customerId: '', ticketId: '' }));
    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: form.toPhone,
          message: text,
          channel: form.channel,
          leadId: form.leadId || undefined,
          customerId: form.customerId || undefined,
          ticketId: form.ticketId || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to send WhatsApp');
      const response = await res.json();
      if (response.status === 'FAILED') {
        toast.error(response.errorMessage || 'Message logged but failed to send');
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } else {
        toast.success('Message sent');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? {
                  ...m,
                  id: response.id || m.id,
                  status: response.status || 'SENT',
                }
              : m
          )
        );
        const userId = session?.user?.id;
        if (userId && response.id) {
          await cacheWhatsAppMessages(userId, [
            {
              ...optimistic,
              id: response.id,
              userId,
              status: response.status || 'SENT',
            },
          ]);
        }
      }
      await loadMessages(channelFilter, { silent: true });
    } catch {
      toast.error('Failed to send WhatsApp message');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setSending(false);
    }
  };

  if (!featureEnabled) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Module disabled</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            WhatsApp is disabled by your Super Admin.
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSummoraLive = config.provider === 'SUMMORA' && config.isActive;
  const connected =
    summoraSession?.status === 'ACTIVE' || summoraSession?.status === 'SYNCING';
  const filterHint =
    filterType === 'CUSTOM'
      ? `${allowedJids.length} selected group${allowedJids.length === 1 ? '' : 's'}`
      : filterType === 'GROUPS_ONLY'
        ? 'Groups only'
        : 'All chats';

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-[520px] flex-col gap-2">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Inbox for linked chats — filter at the source, reply from Opslane.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSummoraLive && (
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs">
              <span className={cn('h-2 w-2 rounded-full', connectionTone(summoraSession?.status))} />
              <span className="font-medium">{statusLabel(summoraSession?.status)}</span>
              <Separator orientation="vertical" className="h-3" />
              <span className="text-muted-foreground">{filterHint}</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadMessages()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="ml-1.5">Refresh</span>
          </Button>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-fit shrink-0">
          <TabsTrigger value="inbox" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-1.5">
            <QrCode className="h-3.5 w-3.5" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="provider" className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Provider
          </TabsTrigger>
        </TabsList>

        {/* ——— Inbox ——— */}
        <TabsContent value="inbox" className="mt-3 min-h-0 flex-1 data-[state=inactive]:hidden">
          <div className="grid h-full min-h-0 overflow-hidden rounded-xl border bg-card md:grid-cols-[minmax(260px,320px)_1fr]">
            {/* Chat list */}
            <div className="flex min-h-0 flex-col border-b md:border-b-0 md:border-r">
              <div className="space-y-2 border-b p-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Search chats…"
                    className="h-9 pl-8"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={channelFilter}
                    onValueChange={(value) => {
                      setChannelFilter(value);
                      void loadMessages(value);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All channels</SelectItem>
                      <SelectItem value="SALES">Sales</SelectItem>
                      <SelectItem value="SERVICE">Service</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {filteredThreads.length} chat{filteredThreads.length === 1 ? '' : 's'}
                  </Badge>
                </div>
              </div>

              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : filteredThreads.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No conversations yet</p>
                    <p className="text-xs text-muted-foreground">
                      Connect WhatsApp and set an inbox filter — matching messages appear here.
                    </p>
                    {isSummoraLive && !connected && (
                      <Button size="sm" className="mt-2" onClick={() => setMainTab('setup')}>
                        Open connection
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredThreads.map((thread) => {
                      const active = thread.key === selectedChatKey;
                      return (
                        <button
                          key={thread.key}
                          type="button"
                          onClick={() => setSelectedChatKey(thread.key)}
                          className={cn(
                            'flex w-full gap-3 px-3 py-3 text-left transition-colors',
                            active ? 'bg-muted' : 'hover:bg-muted/50'
                          )}
                        >
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback
                              className={cn(
                                'text-xs font-semibold',
                                thread.isGroup
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                  : 'bg-muted'
                              )}
                            >
                              {thread.isGroup ? (
                                <Users className="h-4 w-4" />
                              ) : (
                                initials(thread.label)
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium">{thread.label}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(thread.lastMessage.createdAt), {
                                  addSuffix: false,
                                })}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground mt-0.5">
                              {thread.lastMessage.direction === 'OUTBOUND' ? 'You: ' : ''}
                              {thread.preview}
                            </p>
                            {thread.isGroup && (
                              <Badge variant="outline" className="mt-1 h-4 px-1 text-[9px]">
                                Group
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Thread + composer */}
            <div className="flex min-h-0 min-w-0 flex-col bg-[#f0f2f5] dark:bg-muted/30">
              {activeThread ? (
                <>
                  <div className="flex items-center gap-3 border-b bg-background px-3 py-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {activeThread.isGroup ? (
                          <Users className="h-3.5 w-3.5" />
                        ) : (
                          initials(activeThread.label)
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{activeThread.label}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {activeThread.isGroup ? 'Group' : 'Chat'} ·{' '}
                        {activeThread.messages.length} messages · cached locally
                      </p>
                    </div>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="flex min-h-full flex-col justify-end px-3 py-3 sm:px-4">
                      <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5">
                        <div className="mb-2 flex justify-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs shadow-sm"
                            disabled={loadingOlder || !chatHasMore}
                            onClick={() => void loadOlderForChat(activeThread.key)}
                          >
                            {loadingOlder ? (
                              <>
                                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                Loading…
                              </>
                            ) : chatHasMore ? (
                              'Load earlier messages'
                            ) : (
                              'No older messages'
                            )}
                          </Button>
                        </div>

                        {activeThread.messages.map((msg) => {
                          const outbound = msg.direction === 'OUTBOUND';
                          const rawFrom =
                            msg.senderName ||
                            (outbound ? 'You' : activeThread.isGroup ? 'Member' : activeThread.label);
                          const from =
                            rawFrom &&
                            !rawFrom.endsWith('@g.us') &&
                            rawFrom !== activeThread.key.replace(/@g\.us$/, '')
                              ? rawFrom
                              : outbound
                                ? 'You'
                                : 'Member';
                          return (
                            <div
                              key={msg.id}
                              className={cn(
                                'flex flex-col gap-0.5',
                                outbound ? 'items-end' : 'items-start'
                              )}
                            >
                              {!outbound && activeThread.isGroup && (
                                <span className="px-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                  {from}
                                </span>
                              )}
                              <div
                                className={cn(
                                  'max-w-[min(92%,36rem)] rounded-lg px-2.5 py-1.5 text-[13px] leading-snug shadow-sm',
                                  outbound
                                    ? 'rounded-br-sm bg-[#d9fdd3] text-foreground dark:bg-emerald-950'
                                    : 'rounded-bl-sm bg-background'
                                )}
                              >
                                <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                                <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                                  <span>{formatMsgTime(msg.createdAt)}</span>
                                  {outbound && (
                                    <span className="uppercase tracking-wide opacity-70">
                                      {msg.status === 'QUEUED' ? '…' : '✓'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </ScrollArea>

                  <div className="border-t bg-background p-2 sm:p-2.5">
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5">
                      <div className="flex items-end gap-2">
                        <Select
                          value={form.channel}
                          onValueChange={(value) => setForm({ ...form, channel: value })}
                        >
                          <SelectTrigger className="h-9 w-[96px] shrink-0 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SALES">Sales</SelectItem>
                            <SelectItem value="SERVICE">Service</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea
                          value={form.message}
                          onChange={(e) => setForm({ ...form, message: e.target.value })}
                          placeholder="Type a message…"
                          rows={1}
                          className="min-h-[40px] max-h-28 flex-1 resize-none py-2.5"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void sendWhatsApp();
                            }
                          }}
                        />
                        <Button
                          className="h-10 w-10 shrink-0 rounded-full p-0"
                          onClick={() => void sendWhatsApp()}
                          disabled={sending || !form.message.trim()}
                        >
                          {sending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 px-1">
                        <Input
                          value={form.toPhone}
                          onChange={(e) => setForm({ ...form, toPhone: e.target.value })}
                          placeholder={
                            activeThread.isGroup ? 'Group JID' : 'Phone +91…'
                          }
                          className="h-7 max-w-xs text-[11px]"
                        />
                        <Collapsible open={linkIdsOpen} onOpenChange={setLinkIdsOpen}>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-muted-foreground"
                            >
                              <Link2 className="mr-1 h-3 w-3" />
                              Link CRM
                              <ChevronDown
                                className={cn(
                                  'ml-1 h-3 w-3 transition-transform',
                                  linkIdsOpen && 'rotate-180'
                                )}
                              />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="grid gap-1.5 pt-1 sm:grid-cols-3">
                            <Input
                              placeholder="Lead ID"
                              value={form.leadId}
                              onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                              className="h-7 text-xs"
                            />
                            <Input
                              placeholder="Customer ID"
                              value={form.customerId}
                              onChange={(e) =>
                                setForm({ ...form, customerId: e.target.value })
                              }
                              className="h-7 text-xs"
                            />
                            <Input
                              placeholder="Ticket ID"
                              value={form.ticketId}
                              onChange={(e) => setForm({ ...form, ticketId: e.target.value })}
                              className="h-7 text-xs"
                            />
                          </CollapsibleContent>
                        </Collapsible>
                        <span className="text-[10px] text-muted-foreground">
                          Enter to send · Shift+Enter newline
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                  <Phone className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Select a conversation</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Choose a chat on the left to read the thread and reply.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ——— Connection & filter ——— */}
        <TabsContent value="setup" className="mt-3 space-y-4 overflow-y-auto pb-6">
          {!isSummoraLive ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Connect WhatsApp</CardTitle>
                <CardDescription>
                  Set provider to Summora and mark it Active under the Provider tab first.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setMainTab('provider')}>Open provider settings</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        {connected ? (
                          <Wifi className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        Device link
                      </CardTitle>
                      <Badge variant="outline">{statusLabel(summoraSession?.status)}</Badge>
                    </div>
                    <CardDescription>
                      Phone: WhatsApp → Linked devices → Link a device
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {summoraSession?.workspaceSlug && (
                      <p className="text-xs text-muted-foreground">
                        Workspace{' '}
                        <code className="rounded bg-muted px-1">
                          {summoraSession.workspaceSlug}
                        </code>
                      </p>
                    )}

                    {summoraSession?.hint && (
                      <p className="text-sm text-muted-foreground">{summoraSession.hint}</p>
                    )}

                    {summoraSession?.status === 'INITIALIZING' && !summoraSession?.qr && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                        WhatsApp engine is starting. If no QR appears in ~15s, use{' '}
                        <strong>Force reconnect</strong> (common after a Summora server deploy).
                      </div>
                    )}

                    {summoraSession?.qr ? (
                      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={summoraSession.qr}
                          alt="WhatsApp QR code"
                          className="h-52 w-52 rounded-lg border bg-white p-2 shadow-sm"
                        />
                        <p className="text-sm text-muted-foreground max-w-xs">
                          Keep this tab open. QR refreshes automatically until the device is linked.
                        </p>
                      </div>
                    ) : connected ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                        WhatsApp is linked
                        {summoraSession?.status === 'SYNCING'
                          ? ' and catching up on recent messages…'
                          : '.'}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Not linked yet. Generate a QR to connect this workspace.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => startSummoraConnect(false)} disabled={summoraBusy}>
                        {summoraBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <QrCode className="mr-2 h-4 w-4" />
                        )}
                        {summoraSession?.qr ? 'Refresh QR' : 'Connect'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => startSummoraConnect(true)}
                        disabled={summoraBusy}
                      >
                        Force reconnect
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={disconnectSummora}
                        disabled={summoraBusy}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Inbox filter
                    </CardTitle>
                    <CardDescription>
                      Only matching chats are forwarded into Opslane. Summora does not keep a second archive.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(
                        [
                          { id: 'ALL' as const, label: 'All chats', desc: 'DMs + groups' },
                          { id: 'GROUPS_ONLY' as const, label: 'Groups only', desc: 'No DMs' },
                          { id: 'CUSTOM' as const, label: 'Selected', desc: 'Pick groups' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={filterBusy}
                          onClick={() => {
                            if (opt.id === 'CUSTOM') {
                              setFilterType('CUSTOM');
                              return;
                            }
                            void saveSummoraFilters(opt.id);
                          }}
                          className={cn(
                            'rounded-lg border p-3 text-left transition-colors',
                            filterType === opt.id
                              ? 'border-foreground bg-foreground text-background'
                              : 'hover:bg-muted/60'
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-sm font-medium">{opt.label}</span>
                            {filterType === opt.id && <Check className="h-3.5 w-3.5" />}
                          </div>
                          <p
                            className={cn(
                              'mt-1 text-[11px]',
                              filterType === opt.id
                                ? 'text-background/70'
                                : 'text-muted-foreground'
                            )}
                          >
                            {opt.desc}
                          </p>
                        </button>
                      ))}
                    </div>

                    {filterType === 'CUSTOM' && (
                      <div className="space-y-3 rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            Groups ({allowedJids.length} selected)
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={filterBusy}
                            onClick={() => void loadSummoraGroups()}
                          >
                            Refresh list
                          </Button>
                        </div>
                        {groupsError ? (
                          <p className="text-sm text-muted-foreground">{groupsError}</p>
                        ) : groups.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No groups loaded. Connect WhatsApp, then refresh.
                          </p>
                        ) : (
                          <ScrollArea className="h-52 rounded-md border">
                            <div className="p-1">
                              {groups.map((g) => {
                                const selected = allowedJids.includes(g.jid);
                                return (
                                  <button
                                    key={g.jid}
                                    type="button"
                                    onClick={() => toggleGroupJid(g.jid)}
                                    className={cn(
                                      'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm',
                                      selected ? 'bg-muted' : 'hover:bg-muted/50'
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        'flex h-4 w-4 items-center justify-center rounded border',
                                        selected && 'border-foreground bg-foreground text-background'
                                      )}
                                    >
                                      {selected && <Check className="h-3 w-3" />}
                                    </span>
                                    <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{g.name || g.jid}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        )}
                        <Button
                          disabled={filterBusy}
                          onClick={() => saveSummoraFilters('CUSTOM', allowedJids)}
                        >
                          {filterBusy ? 'Saving…' : `Save selection (${allowedJids.length})`}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ——— Provider ——— */}
        <TabsContent value="provider" className="mt-3 space-y-4 overflow-y-auto pb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Provider configuration</CardTitle>
              <CardDescription>
                Choose how this workspace sends and receives WhatsApp. Most teams use Summora.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Provider</Label>
                  <Select
                    value={config.provider}
                    onValueChange={(value) => setConfig({ ...config, provider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DISABLED">Disabled</SelectItem>
                      <SelectItem value="SUMMORA">Summora (recommended)</SelectItem>
                      <SelectItem value="TWILIO">Twilio</SelectItem>
                      <SelectItem value="META_CLOUD">Meta Cloud API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={config.isActive ? 'ACTIVE' : 'INACTIVE'}
                    onValueChange={(value) =>
                      setConfig({ ...config, isActive: value === 'ACTIVE' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {config.provider === 'TWILIO' && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Account SID</Label>
                    <Input
                      value={config.twilioAccountSid}
                      onChange={(e) =>
                        setConfig({ ...config, twilioAccountSid: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Auth token</Label>
                    <Input
                      type="password"
                      value={config.twilioAuthToken}
                      onChange={(e) =>
                        setConfig({ ...config, twilioAuthToken: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>From number</Label>
                    <Input
                      placeholder="+14155238886"
                      value={config.twilioFromNumber}
                      onChange={(e) =>
                        setConfig({ ...config, twilioFromNumber: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {config.provider === 'META_CLOUD' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Access token</Label>
                    <Input
                      type="password"
                      value={config.metaAccessToken}
                      onChange={(e) =>
                        setConfig({ ...config, metaAccessToken: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone number ID</Label>
                    <Input
                      value={config.metaPhoneNumberId}
                      onChange={(e) =>
                        setConfig({ ...config, metaPhoneNumberId: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Business ID</Label>
                    <Input
                      value={config.metaBusinessId}
                      onChange={(e) =>
                        setConfig({ ...config, metaBusinessId: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API version</Label>
                    <Input
                      value={config.metaApiVersion}
                      onChange={(e) =>
                        setConfig({ ...config, metaApiVersion: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Webhook verify token</Label>
                    <Input
                      type="password"
                      value={config.webhookVerifyToken}
                      onChange={(e) =>
                        setConfig({ ...config, webhookVerifyToken: e.target.value })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground md:col-span-2 break-all">
                    Webhook:{' '}
                    <code>
                      {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp/webhook?userId=${session?.user?.id || ''}`}
                    </code>
                  </p>
                </div>
              )}

              {config.provider === 'SUMMORA' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Summora base URL</Label>
                    <Input
                      placeholder="https://summora.jabin.org"
                      value={config.summoraBaseUrl}
                      onChange={(e) =>
                        setConfig({ ...config, summoraBaseUrl: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bridge API key</Label>
                    <Input
                      type="password"
                      value={config.summoraApiKey}
                      onChange={(e) =>
                        setConfig({ ...config, summoraApiKey: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Webhook signing secret</Label>
                    <Input
                      type="password"
                      value={config.webhookVerifyToken}
                      onChange={(e) =>
                        setConfig({ ...config, webhookVerifyToken: e.target.value })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground md:col-span-2 break-all">
                    Bridge webhook:{' '}
                    <code>
                      {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp/webhook?userId=${session?.user?.id || ''}&provider=SUMMORA`}
                    </code>
                  </p>
                </div>
              )}

              <Button onClick={saveConfig} disabled={savingConfig}>
                {savingConfig ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save provider'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

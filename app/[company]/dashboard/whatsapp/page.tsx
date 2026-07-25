'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { FullTableSkeleton } from '@/components/loading';

const statusColor: Record<string, string> = {
  SENT: 'text-foreground underline decoration-zinc-500 underline-offset-4',
  DELIVERED: 'text-foreground font-black tracking-widest',
  READ: 'text-muted-foreground line-through opacity-50',
  FAILED: 'text-foreground border border-foreground px-1 bg-foreground text-background',
  QUEUED: 'text-muted-foreground italic',
};

export default function WhatsAppHubPage() {
  const { data: session } = useSession();
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [summoraSession, setSummoraSession] = useState<{
    status: string;
    qr: string | null;
    hasQr: boolean;
    workspaceSlug?: string;
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
    channel: 'SALES',
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
    } catch (error) {
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
      toast.success('WhatsApp provider config saved');
      await loadConfig();
    } catch (error) {
      toast.error('Failed to save provider config');
    } finally {
      setSavingConfig(false);
    }
  };

  const loadMessages = async (channel = channelFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (channel !== 'ALL') params.append('channel', channel);
      const res = await fetch(`/api/whatsapp/messages?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      // New shape: { messages, inboxFilter }; legacy: bare array
      const list = Array.isArray(data) ? data : data.messages ?? [];
      setMessages(list);
      if (data?.inboxFilter?.filterType) {
        const next = String(data.inboxFilter.filterType).toUpperCase();
        setFilterType(
          next === 'GROUPS_ONLY' || next === 'CUSTOM' ? next : 'ALL'
        );
        if (Array.isArray(data.inboxFilter.allowedJids)) {
          setAllowedJids(data.inboxFilter.allowedJids);
        }
      }
    } catch {
      toast.error('Failed to load WhatsApp history');
    } finally {
      setLoading(false);
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
      });
      toast.success('Scan the QR with WhatsApp on your phone');
    } catch (error: any) {
      toast.error(error?.message || 'Could not start WhatsApp connection');
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
    } catch (error: any) {
      toast.error(error?.message || 'Could not disconnect');
    } finally {
      setSummoraBusy(false);
    }
  };

  const loadSummoraFilters = async () => {
    const res = await fetch('/api/whatsapp/summora/filters', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load filters');
    const next = String(data.filterType || 'ALL').toUpperCase();
    setFilterType(
      next === 'GROUPS_ONLY' || next === 'CUSTOM' ? next : 'ALL'
    );
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
      toast.success('Inbox filter saved — only matching chats will appear below');
      await loadMessages();
    } catch (error: any) {
      toast.error(error?.message || 'Could not save filter');
    } finally {
      setFilterBusy(false);
    }
  };

  const toggleGroupJid = (jid: string) => {
    const next = allowedJids.includes(jid)
      ? allowedJids.filter((j) => j !== jid)
      : [...allowedJids, jid];
    setAllowedJids(next);
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
        /* ignore transient poll errors */
      }
    };
    void tick();

    const status = summoraSession?.status;
    // Poll faster only while waiting for QR / link; back off once linked.
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
    void loadSummoraFilters().catch(() => {
      /* ignore until connected */
    });
  }, [config.provider, config.isActive]);

  useEffect(() => {
    if (config.provider !== 'SUMMORA' || !config.isActive) return;
    if (filterType !== 'CUSTOM') return;
    // Groups are available once the socket is up (ACTIVE or still SYNCING history).
    const ready =
      summoraSession?.status === 'ACTIVE' ||
      summoraSession?.status === 'SYNCING';
    if (!ready) return;
    void loadSummoraGroups();
  }, [config.provider, config.isActive, filterType, summoraSession?.status]);

  if (!featureEnabled) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Module Disabled</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            WhatsApp is disabled by your Super Admin.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sendWhatsApp = async () => {
    if (!form.toPhone || !form.message) {
      toast.error('Phone number and message are required');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: form.toPhone,
          message: form.message,
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
      } else {
        toast.success('WhatsApp message sent');
      }
      setForm({
        toPhone: '',
        message: '',
        channel: form.channel,
        leadId: '',
        customerId: '',
        ticketId: '',
      });
      loadMessages();
    } catch (error) {
      toast.error('Failed to send WhatsApp message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-6 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send and review WhatsApp messages for this workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Provider configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] uppercase font-bold tracking-widest opacity-70">Active Provider</Label>
              <Select value={config.provider} onValueChange={(value) => setConfig({ ...config, provider: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DISABLED">Disabled</SelectItem>
                  <SelectItem value="TWILIO">Twilio</SelectItem>
                  <SelectItem value="META_CLOUD">Meta Cloud API</SelectItem>
                  <SelectItem value="SUMMORA">Summora (Baileys bridge)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] uppercase font-bold tracking-widest opacity-70">Operational Status</Label>
              <Select value={config.isActive ? 'ACTIVE' : 'INACTIVE'} onValueChange={(value) => setConfig({ ...config, isActive: value === 'ACTIVE' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Label>Twilio Account SID</Label>
                <Input value={config.twilioAccountSid} onChange={(e) => setConfig({ ...config, twilioAccountSid: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Twilio Auth Token</Label>
                <Input type="password" value={config.twilioAuthToken} onChange={(e) => setConfig({ ...config, twilioAuthToken: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Twilio WhatsApp From</Label>
                <Input placeholder="+14155238886" value={config.twilioFromNumber} onChange={(e) => setConfig({ ...config, twilioFromNumber: e.target.value })} />
              </div>
            </div>
          )}

          {config.provider === 'META_CLOUD' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Meta Access Token</Label>
                <Input type="password" value={config.metaAccessToken} onChange={(e) => setConfig({ ...config, metaAccessToken: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone Number ID</Label>
                <Input value={config.metaPhoneNumberId} onChange={(e) => setConfig({ ...config, metaPhoneNumberId: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Business ID (Optional)</Label>
                <Input value={config.metaBusinessId} onChange={(e) => setConfig({ ...config, metaBusinessId: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Graph API Version</Label>
                <Input value={config.metaApiVersion} onChange={(e) => setConfig({ ...config, metaApiVersion: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Webhook Verify Token</Label>
                <Input type="password" value={config.webhookVerifyToken} onChange={(e) => setConfig({ ...config, webhookVerifyToken: e.target.value })} />
              </div>
              <div className="text-xs text-muted-foreground md:col-span-2">
                Meta webhook URL: <code>{`${typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp/webhook?userId=${session?.user?.id || ''}`}</code>
              </div>
            </div>
          )}

          {config.provider === 'SUMMORA' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Summora base URL</Label>
                <Input
                  placeholder="https://summora.jabin.org"
                  value={config.summoraBaseUrl}
                  onChange={(e) => setConfig({ ...config, summoraBaseUrl: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bridge API key</Label>
                <Input
                  type="password"
                  value={config.summoraApiKey}
                  onChange={(e) => setConfig({ ...config, summoraApiKey: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Webhook signing secret</Label>
                <Input
                  type="password"
                  value={config.webhookVerifyToken}
                  onChange={(e) => setConfig({ ...config, webhookVerifyToken: e.target.value })}
                />
              </div>
              <div className="text-xs text-muted-foreground md:col-span-2 space-y-1">
                <p>
                  Webhook URL for Summora bridge app:
                </p>
                <code className="block break-all">
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp/webhook?userId=${session?.user?.id || ''}&provider=SUMMORA`}
                </code>
              </div>
            </div>
          )}

          <Button onClick={saveConfig} disabled={savingConfig}>
            {savingConfig ? 'Saving...' : 'Save Provider Config'}
          </Button>
        </CardContent>
      </Card>

      {config.provider === 'SUMMORA' && config.isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Connect WhatsApp</CardTitle>
            <CardDescription>
              Scan from Opslane — phone: WhatsApp → Linked devices → Link a device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">
                {summoraSession?.status || '…'}
              </Badge>
              {summoraSession?.workspaceSlug && (
                <span className="text-xs text-muted-foreground">
                  workspace: {summoraSession.workspaceSlug}
                </span>
              )}
            </div>

            {summoraSession?.qr ? (
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={summoraSession.qr}
                  alt="WhatsApp QR code"
                  className="h-56 w-56 rounded-md border bg-white p-2"
                />
                <p className="max-w-sm text-sm text-muted-foreground">
                  QR refreshes automatically. Keep this page open until status becomes ACTIVE or SYNCING.
                </p>
              </div>
            ) : summoraSession?.status === 'ACTIVE' || summoraSession?.status === 'SYNCING' ? (
              <p className="text-sm text-muted-foreground">
                WhatsApp is linked
                {summoraSession.status === 'SYNCING' ? ' and syncing missed messages…' : '.'}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not linked yet. Click Connect to show a QR code here.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => startSummoraConnect(false)}
                disabled={summoraBusy}
              >
                {summoraBusy ? 'Working…' : summoraSession?.qr ? 'Refresh QR' : 'Connect WhatsApp'}
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
      )}

      {config.provider === 'SUMMORA' && config.isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Inbox filter</CardTitle>
            <CardDescription>
              Choose which WhatsApp chats are forwarded into Opslane. Matching
              messages are stored here only — Summora is connection + filter, not a chat archive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'ALL' as const, label: 'All chats' },
                  { id: 'GROUPS_ONLY' as const, label: 'Groups only' },
                  { id: 'CUSTOM' as const, label: 'Selected groups' },
                ] as const
              ).map((opt) => (
                <Button
                  key={opt.id}
                  type="button"
                  size="sm"
                  variant={filterType === opt.id ? 'default' : 'outline'}
                  disabled={filterBusy}
                  onClick={() => {
                    if (opt.id === 'CUSTOM') {
                      setFilterType('CUSTOM');
                      return;
                    }
                    void saveSummoraFilters(opt.id);
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {filterType === 'CUSTOM' && (
              <div className="space-y-3">
                {groupsError ? (
                  <p className="text-sm text-muted-foreground">{groupsError}</p>
                ) : groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No groups loaded yet. Connect WhatsApp, then refresh.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                    {groups.map((g) => {
                      const selected = allowedJids.includes(g.jid);
                      return (
                        <button
                          key={g.jid}
                          type="button"
                          onClick={() => toggleGroupJid(g.jid)}
                          className={cn(
                            'flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors',
                            selected
                              ? 'bg-foreground text-background'
                              : 'hover:bg-muted'
                          )}
                        >
                          <span className="truncate font-medium">{g.name || g.jid}</span>
                          <span className="ml-2 shrink-0 text-xs opacity-70">
                            {selected ? 'Selected' : 'Select'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={filterBusy}
                    onClick={() => saveSummoraFilters('CUSTOM', allowedJids)}
                  >
                    {filterBusy ? 'Saving…' : `Save selection (${allowedJids.length})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={filterBusy}
                    onClick={() => void loadSummoraGroups()}
                  >
                    Refresh groups
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Send message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] uppercase font-bold tracking-widest opacity-70">Logic Channel</Label>
              <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALES">Sales</SelectItem>
                  <SelectItem value="SERVICE">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-[9px] uppercase font-bold tracking-widest opacity-70">Destination Address</Label>
              <Input
                value={form.toPhone}
                onChange={(e) => setForm({ ...form, toPhone: e.target.value })}
                placeholder="+919999999999"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Lead ID (Optional)</Label>
              <Input value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Customer ID (Optional)</Label>
              <Input value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Ticket ID (Optional)</Label>
              <Input value={form.ticketId} onChange={(e) => setForm({ ...form, ticketId: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] uppercase font-bold tracking-widest opacity-70">Payload Content</Label>
            <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} />
          </div>

          <Button onClick={sendWhatsApp} disabled={sending}>
            {sending ? 'Sending...' : 'Send WhatsApp'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Conversations</CardTitle>
              <CardDescription className="mt-1">
                {filterType === 'CUSTOM'
                  ? `Showing only ${allowedJids.length} selected group${allowedJids.length === 1 ? '' : 's'} (inbox filter). New messages outside the selection are never forwarded from Summora.`
                  : filterType === 'GROUPS_ONLY'
                    ? 'Showing group chats only — DMs are blocked at Summora before they reach Opslane.'
                    : 'Showing all forwarded chats. Change Inbox filter above to limit which chats arrive.'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void loadMessages()}
              >
                Refresh
              </Button>
              <Select
                value={channelFilter}
                onValueChange={(value) => {
                  setChannelFilter(value);
                  loadMessages(value);
                }}
              >
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Channels</SelectItem>
                  <SelectItem value="SALES">Sales</SelectItem>
                  <SelectItem value="SERVICE">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <FullTableSkeleton columnCount={6} rowCount={5} />
          ) : (
          <div className="rounded-none border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Chat</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No messages for the current inbox filter yet. After you save Selected groups,
                      only new matching WhatsApp traffic appears here.
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map((msg: any) => {
                    const chatLabel =
                      (msg.isGroup || String(msg.chatJid || '').endsWith('@g.us')
                        ? groups.find((g) => g.jid === msg.chatJid)?.name
                        : null) ||
                      msg.chatJid ||
                      msg.fromPhone ||
                      msg.toPhone ||
                      '—';
                    const fromLabel =
                      msg.senderName ||
                      (msg.direction === 'OUTBOUND' ? 'You' : null) ||
                      msg.fromPhone ||
                      '—';
                    return (
                      <TableRow key={msg.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(msg.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium truncate max-w-[220px]">
                              {chatLabel}
                            </span>
                            {(msg.isGroup || String(msg.chatJid || '').endsWith('@g.us')) && (
                              <Badge variant="secondary" className="w-fit text-[10px]">
                                Group
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[160px]">
                          {fromLabel}
                        </TableCell>
                        <TableCell>{msg.direction}</TableCell>
                        <TableCell>
                          <span className={cn("text-[10px] font-bold uppercase", statusColor[msg.status] || 'text-muted-foreground')}>
                            {msg.status}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[380px] truncate">{msg.message}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


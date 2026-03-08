'use client';

import { useEffect, useState } from 'react';
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

const statusColor: Record<string, string> = {
  SENT: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  READ: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  QUEUED: 'bg-yellow-100 text-yellow-700',
};

export default function WhatsAppHubPage() {
  const { data: session } = useSession();
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
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
      const enabled = featureData?.modules?.WHATSAPP !== false;
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
      setMessages(await res.json());
    } catch (error) {
      toast.error('Failed to load WhatsApp history');
    } finally {
      setLoading(false);
    }
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

  if (!featureEnabled) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
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
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">WhatsApp Hub</h1>
        <p className="text-sm text-muted-foreground">Send and monitor sales and service WhatsApp conversations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider Setup</CardTitle>
          <CardDescription>Each customer can self-onboard Twilio or Meta Cloud API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={config.provider} onValueChange={(value) => setConfig({ ...config, provider: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DISABLED">Disabled</SelectItem>
                  <SelectItem value="TWILIO">Twilio</SelectItem>
                  <SelectItem value="META_CLOUD">Meta Cloud API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
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

          <Button onClick={saveConfig} disabled={savingConfig}>
            {savingConfig ? 'Saving...' : 'Save Provider Config'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send Message</CardTitle>
          <CardDescription>Uses your selected provider configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALES">Sales</SelectItem>
                  <SelectItem value="SERVICE">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Recipient Phone</Label>
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

          <div className="space-y-2">
            <Label>Message</Label>
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
              <CardTitle>Conversation Log</CardTitle>
              <CardDescription>Latest outbound/inbound WhatsApp activity.</CardDescription>
            </div>
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
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading messages...</TableCell></TableRow>
                ) : messages.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No WhatsApp messages found.</TableCell></TableRow>
                ) : (
                  messages.map((msg: any) => (
                    <TableRow key={msg.id}>
                      <TableCell>{new Date(msg.createdAt).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{msg.channel}</Badge></TableCell>
                      <TableCell>{msg.direction}</TableCell>
                      <TableCell>{msg.toPhone}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor[msg.status] || 'bg-muted'}`}>
                          {msg.status}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[380px] truncate">{msg.message}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

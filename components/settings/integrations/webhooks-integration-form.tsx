'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/contexts/settings-context';
import type { SettingsUpdatePayload } from '@/types/settings';
import type { OutgoingWebhookSubscription } from '@/lib/integrations/types';

const WEBHOOK_EVENTS = [
  'ticket.created',
  'ticket.updated',
  'deal.won',
  'invoice.paid',
  'customer.created',
] as const;

const EMPTY_WEBHOOKS = {
  enabled: false,
  signingSecret: '',
  subscriptions: [] as OutgoingWebhookSubscription[],
};

interface WebhooksIntegrationFormProps {
  onChange?: (changes: SettingsUpdatePayload) => void;
}

export function WebhooksIntegrationForm({ onChange }: WebhooksIntegrationFormProps) {
  const { settings } = useSettings();
  const [local, setLocal] = useState(EMPTY_WEBHOOKS);

  useEffect(() => {
    const webhooks = settings?.integrations?.webhooks;
    if (webhooks) {
      setLocal({
        enabled: webhooks.enabled ?? false,
        signingSecret: webhooks.signingSecret ?? '',
        subscriptions: webhooks.subscriptions ?? [],
      });
    }
  }, [settings?.integrations?.webhooks]);

  const push = (next: typeof local) => {
    setLocal(next);
    onChange?.({
      settings: {
        integrations: {
          webhooks: next,
        },
      },
    });
  };

  const addSubscription = () => {
    push({
      ...local,
      subscriptions: [
        ...local.subscriptions,
        {
          id: crypto.randomUUID(),
          name: 'New webhook',
          url: '',
          events: ['ticket.created'],
          enabled: true,
        },
      ],
    });
  };

  const updateSubscription = (
    id: string,
    patch: Partial<OutgoingWebhookSubscription>
  ) => {
    push({
      ...local,
      subscriptions: local.subscriptions.map((s) =>
        s.id === id ? { ...s, ...patch } : s
      ),
    });
  };

  const removeSubscription = (id: string) => {
    push({
      ...local,
      subscriptions: local.subscriptions.filter((s) => s.id !== id),
    });
  };

  const toggleEvent = (id: string, event: string) => {
    const sub = local.subscriptions.find((s) => s.id === id);
    if (!sub) return;
    const events = sub.events.includes(event)
      ? sub.events.filter((e) => e !== event)
      : [...sub.events, event];
    updateSubscription(id, { events });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label>Enable outgoing webhooks</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Opslane will POST signed payloads to your URLs when events occur.
          </p>
        </div>
        <Switch
          checked={local.enabled}
          onCheckedChange={(checked) => push({ ...local, enabled: checked })}
        />
      </div>

      <div className="grid gap-2 max-w-lg">
        <Label>Signing secret</Label>
        <Input
          type="password"
          placeholder="Used to verify X-Opslane-Signature on deliveries"
          value={local.signingSecret}
          onChange={(e) => push({ ...local, signingSecret: e.target.value })}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Endpoints</Label>
          <Button type="button" size="sm" variant="outline" onClick={addSubscription}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add endpoint
          </Button>
        </div>

        {local.subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
            No endpoints yet. Add a URL to receive ticket, deal, or invoice events.
          </p>
        ) : (
          local.subscriptions.map((sub) => (
            <div key={sub.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="grid gap-2 flex-1">
                  <Input
                    value={sub.name}
                    onChange={(e) =>
                      updateSubscription(sub.id, { name: e.target.value })
                    }
                    placeholder="Label"
                  />
                  <Input
                    value={sub.url}
                    onChange={(e) =>
                      updateSubscription(sub.id, { url: e.target.value })
                    }
                    placeholder="https://your-app.com/webhooks/opslane"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-destructive"
                  onClick={() => removeSubscription(sub.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={sub.enabled}
                  onCheckedChange={(checked) =>
                    updateSubscription(sub.id, { enabled: checked })
                  }
                />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WEBHOOK_EVENTS.map((event) => (
                  <Badge
                    key={event}
                    variant={sub.events.includes(event) ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px]"
                    onClick={() => toggleEvent(sub.id, event)}
                  >
                    {event}
                  </Badge>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

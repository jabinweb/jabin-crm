'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { confirmAction } from '@/lib/confirm-action';
import {
  slackEventsForScope,
  type SlackEventOption,
  type SlackScope,
} from '@/lib/integrations/slack-events';
import type { SlackDestinationView } from '@/lib/integrations/slack-destinations';

const SLACK_WEBHOOK_HELP = 'https://api.slack.com/messaging/webhooks';

function groupEvents(options: SlackEventOption[]) {
  const groups = new Map<string, SlackEventOption[]>();
  for (const option of options) {
    const list = groups.get(option.group);
    if (list) list.push(option);
    else groups.set(option.group, [option]);
  }
  return Array.from(groups.entries());
}

function formatWhen(value: string | Date | null) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Slack alert destinations.
 * - `workspace`: channels that receive workspace events (admins only).
 * - `personal`: the signed-in user's own alerts, mirroring their notifications.
 * Saves straight to the API — it does not use the settings page's Save bar.
 */
export function SlackDestinations({
  scope,
  onChanged,
}: {
  scope: SlackScope;
  /** Called after any change so a parent can refresh integration status */
  onChanged?: () => void;
}) {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['slack-destinations', slug, scope] as const, [slug, scope]);
  const eventGroups = useMemo(() => groupEvents(slackEventsForScope(scope)), [scope]);

  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await workspaceFetch(`/api/integrations/slack?scope=${scope}`);
      if (!res.ok) throw new Error('Failed to load Slack settings');
      return (await res.json()) as { destinations: SlackDestinationView[] };
    },
    enabled: !!slug,
  });
  const destinations = data?.destinations ?? [];

  const replace = (next: SlackDestinationView) =>
    queryClient.setQueryData<{ destinations: SlackDestinationView[] }>(queryKey, (prev) =>
      prev
        ? { destinations: prev.destinations.map((d) => (d.id === next.id ? next : d)) }
        : prev
    );

  const call = async (url: string, init: RequestInit) => {
    const res = await workspaceFetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (body.destination) replace(body.destination as SlackDestinationView);
      throw new Error(body.error || 'Request failed');
    }
    return body;
  };

  const addMutation = useMutation({
    mutationFn: () =>
      call('/api/integrations/slack', {
        method: 'POST',
        body: JSON.stringify({ scope, name: name.trim(), webhookUrl: webhookUrl.trim() }),
      }),
    onSuccess: () => {
      setName('');
      setWebhookUrl('');
      toast.success('Slack connected — check the channel for a confirmation message');
      void queryClient.invalidateQueries({ queryKey });
      onChanged?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      call(`/api/integrations/slack/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: (next: SlackDestinationView) => {
      replace(next);
      onChanged?.();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const sendTest = async (id: string) => {
    setTestingId(id);
    try {
      replace(await call(`/api/integrations/slack/${id}`, { method: 'POST' }));
      toast.success('Test message sent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTestingId(null);
    }
  };

  const remove = async (destination: SlackDestinationView) => {
    const ok = await confirmAction({
      title: `Disconnect “${destination.name}”?`,
      description: 'Alerts will stop being posted there. You can connect it again later.',
      confirmLabel: 'Disconnect',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await call(`/api/integrations/slack/${destination.id}`, { method: 'DELETE' });
      void queryClient.invalidateQueries({ queryKey });
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not disconnect');
    }
  };

  const toggleEvent = (destination: SlackDestinationView, key: string) => {
    const events = destination.events.includes(key)
      ? destination.events.filter((e) => e !== key)
      : [...destination.events, key];
    replace({ ...destination, events });
    patchMutation.mutate({ id: destination.id, patch: { events } });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {scope === 'workspace'
          ? 'Post workspace activity to Slack channels. Each channel chooses which events it receives.'
          : 'Get your own notifications in Slack — as a DM to yourself or in any channel you pick.'}{' '}
        <a
          href={SLACK_WEBHOOK_HELP}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
        >
          How to create an incoming webhook
          <ExternalLink className="h-3 w-3" />
        </a>
      </p>

      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : isError ? (
        <p className="text-sm text-destructive">Slack settings could not be loaded.</p>
      ) : (
        destinations.map((destination) => (
          <div key={destination.id} className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{destination.name}</p>
                <p className="text-xs text-muted-foreground">
                  {destination.webhookHint}
                  {destination.lastDeliveredAt
                    ? ` · last delivered ${formatWhen(destination.lastDeliveredAt)}`
                    : ' · nothing delivered yet'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingId === destination.id}
                  onClick={() => void sendTest(destination.id)}
                >
                  {testingId === destination.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Send test
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Disconnect ${destination.name}`}
                  onClick={() => void remove(destination)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Switch
                  checked={destination.enabled}
                  aria-label={`Enable ${destination.name}`}
                  onCheckedChange={(enabled) => {
                    replace({ ...destination, enabled });
                    patchMutation.mutate({ id: destination.id, patch: { enabled } });
                  }}
                />
              </div>
            </div>

            {destination.lastError ? (
              <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Last delivery failed: {destination.lastError}
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {eventGroups.map(([group, options]) => (
                <fieldset key={group} className="space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </legend>
                  {options.map((option) => {
                    const inputId = `${destination.id}-${option.key}`;
                    return (
                      <div key={option.key} className="flex items-center gap-2">
                        <Checkbox
                          id={inputId}
                          checked={destination.events.includes(option.key)}
                          onCheckedChange={() => toggleEvent(destination, option.key)}
                        />
                        <Label htmlFor={inputId} className="text-sm font-normal">
                          {option.label}
                        </Label>
                      </div>
                    );
                  })}
                </fieldset>
              ))}
            </div>
            {destination.events.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No events selected — nothing will be posted here.
              </p>
            ) : null}
          </div>
        ))
      )}

      <div className="space-y-3 rounded-lg border border-dashed p-4">
        <p className="text-sm font-medium">
          {destinations.length === 0 ? 'Connect Slack' : 'Add another destination'}
        </p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="space-y-1.5">
            <Label htmlFor={`slack-name-${scope}`}>Label</Label>
            <Input
              id={`slack-name-${scope}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={scope === 'workspace' ? '#delivery' : 'My alerts'}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`slack-url-${scope}`}>Incoming webhook URL</Label>
            <Input
              id={`slack-url-${scope}`}
              type="password"
              autoComplete="off"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/…"
            />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!webhookUrl.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          {addMutation.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-4 w-4" />
          )}
          Connect and send test
        </Button>
      </div>
    </div>
  );
}

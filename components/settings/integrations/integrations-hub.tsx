'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CreditCard,
  Mail,
  MessageSquare,
  Plug,
  Webhook,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SettingsProvider, useSettings } from '@/contexts/settings-context';
import { SettingsLayout } from '@/components/settings/settings-layout';
import { RazorpayIntegrationForm } from '@/components/settings/integrations/razorpay-integration-form';
import { WebhooksIntegrationForm } from '@/components/settings/integrations/webhooks-integration-form';
import { EmailIntegrationForm } from '@/components/settings/integrations/email-integration-form';
import { GoogleCalendarSettings } from '@/components/crm/google-calendar-settings';
import { INTEGRATION_CATEGORY_LABELS } from '@/lib/integrations/catalog';
import type { IntegrationStatusRow } from '@/lib/integrations/types';
import type { SettingsUpdatePayload } from '@/types/settings';
import { SettingsPageSkeleton, FormSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';

const PANEL_IDS = new Set([
  'razorpay',
  'webhooks',
  'email',
  'google_calendar',
]);

const ICONS: Record<string, typeof Plug> = {
  razorpay: CreditCard,
  whatsapp: MessageSquare,
  email: Mail,
  google_calendar: Calendar,
  webhooks: Webhook,
  api: BookOpen,
};

function statusVariant(
  status: IntegrationStatusRow['status']
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'connected':
      return 'default';
    case 'configured':
      return 'secondary';
    case 'unavailable':
      return 'destructive';
    default:
      return 'outline';
  }
}

function IntegrationsHubContent() {
  const params = useParams<{ company?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceSlug = typeof params?.company === 'string' ? params.company : undefined;
  const { path, workspaceFetch } = useWorkspacePaths();
  const [isDirty, setIsDirty] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<SettingsUpdatePayload>({});
  const panelFromUrl = searchParams.get('panel');
  const [activePanel, setActivePanel] = useState<string | null>(
    panelFromUrl && PANEL_IDS.has(panelFromUrl) ? panelFromUrl : null
  );
  const { updateSettings, isUpdating, isLoading: settingsLoading } = useSettings();

  const { data, isPending, refetch } = useQuery({
    queryKey: ['company-integrations', workspaceSlug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/dashboard/integrations');
      if (!res.ok) throw new Error('Failed to load integrations');
      return res.json() as Promise<{ integrations: IntegrationStatusRow[] }>;
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, IntegrationStatusRow[]>();
    for (const row of data?.integrations ?? []) {
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    return map;
  }, [data?.integrations]);

  const handleSettingsChange = (changes: SettingsUpdatePayload) => {
    setPendingChanges((prev) => ({
      company: { ...prev.company, ...changes.company },
      settings: { ...prev.settings, ...changes.settings },
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (pendingChanges.settings) {
      await updateSettings(pendingChanges.settings);
    }
    setIsDirty(false);
    setPendingChanges({});
    await refetch();
  };

  const openPanel = (id: string, inline?: string) => {
    if (inline) {
      setActivePanel(id);
      router.replace(`${path('/dashboard/settings/integrations')}?panel=${id}`, {
        scroll: false,
      });
      return;
    }
    setActivePanel(null);
  };

  useEffect(() => {
    if (panelFromUrl && PANEL_IDS.has(panelFromUrl)) {
      setActivePanel(panelFromUrl);
    }
  }, [panelFromUrl]);

  // Single page loader — integrations catalog only (settings load in background for panels).
  if (isPending) {
    return <SettingsPageSkeleton cards={6} />;
  }

  return (
    <SettingsLayout onSave={handleSave} isLoading={isUpdating} isDirty={isDirty}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Plug className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Connect payments, messaging, calendar, and developer tools for this workspace.
          Credentials are stored on your company record or admin accounts — never shared
          across tenants.
        </p>
      </div>

      <div className="space-y-8">
        {Array.from(grouped.entries()).map(([category, rows]) => (
          <section key={category} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {INTEGRATION_CATEGORY_LABELS[category as keyof typeof INTEGRATION_CATEGORY_LABELS] ??
                category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => {
                const Icon = ICONS[row.id] ?? Plug;
                const isActive = activePanel === row.id;
                return (
                  <Card
                    key={row.id}
                    className={cn(
                      'flex flex-col transition-shadow',
                      isActive && 'ring-2 ring-primary'
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="rounded-md border bg-muted/50 p-2">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{row.name}</CardTitle>
                            <Badge
                              variant={statusVariant(row.status)}
                              className="mt-1 text-[10px]"
                            >
                              {row.statusLabel}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="text-xs leading-relaxed">
                        {row.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto space-y-3 pt-0">
                      {row.detail ? (
                        <p className="text-xs text-muted-foreground truncate">{row.detail}</p>
                      ) : null}
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {row.scope === 'company'
                          ? 'Company-wide'
                          : 'Workspace admin account'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {row.inlinePanel ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={isActive ? 'default' : 'outline'}
                            onClick={() => openPanel(row.id, row.inlinePanel)}
                          >
                            Configure
                          </Button>
                        ) : row.configurePath ? (
                          <Button type="button" size="sm" asChild>
                            <Link href={path(row.configurePath)}>
                              Configure
                              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        ) : row.docsPath ? (
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={path(row.docsPath)}>
                              API docs
                              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {activePanel === 'razorpay' && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Razorpay</CardTitle>
            <CardDescription>
              Company payment credentials for this tenant. Save changes with the bar below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <FormSkeleton fields={4} />
            ) : (
              <RazorpayIntegrationForm onChange={handleSettingsChange} />
            )}
          </CardContent>
        </Card>
      )}

      {activePanel === 'webhooks' && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Outgoing webhooks</CardTitle>
            <CardDescription>
              Register HTTPS endpoints to receive event notifications from Opslane.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <FormSkeleton fields={4} />
            ) : (
              <WebhooksIntegrationForm onChange={handleSettingsChange} />
            )}
          </CardContent>
        </Card>
      )}

      {activePanel === 'email' && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Email (SMTP / IMAP)</CardTitle>
            <CardDescription>
              Workspace sending and reply tracking — saved on your admin profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailIntegrationForm embedded onSaved={() => void refetch()} />
          </CardContent>
        </Card>
      )}

      {activePanel === 'google_calendar' && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Google Calendar</CardTitle>
            <CardDescription>
              Connect Google to sync CRM events with your calendar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GoogleCalendarSettings />
          </CardContent>
        </Card>
      )}
    </SettingsLayout>
  );
}

export function IntegrationsHub() {
  return (
    <SettingsProvider>
      <IntegrationsHubContent />
    </SettingsProvider>
  );
}

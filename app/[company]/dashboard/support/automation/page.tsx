'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Save, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { humanizeEnum, ENUM_LABEL_OVERRIDES } from '@/lib/humanize-enum';
import { toast } from 'sonner';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { SupportBackLink } from '@/components/support/support-back-link';
import { CardListSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import type { AutomationRule, AutomationTrigger } from '@/lib/support/automation-rules';

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  TICKET_CREATED: 'a ticket is created',
  TICKET_STATUS_CHANGED: 'a ticket changes status',
  SLA_AT_RISK: 'an SLA is at risk',
  SLA_BREACHED: 'an SLA is breached',
};

export default function SupportAutomationPage() {
  const queryClient = useQueryClient();
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const [localRules, setLocalRules] = useState<AutomationRule[] | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['automation-rules', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/automation-rules');
      if (!res.ok) throw new Error('Failed to load rules');
      return res.json();
    },
  });

  const rules = localRules ?? data?.rules ?? [];

  const saveMutation = useMutation({
    mutationFn: async (next: AutomationRule[]) => {
      const res = await workspaceFetch('/api/support/automation-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: next }),
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Automation rules saved');
      setLocalRules(null);
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    },
    onError: () => toast.error('Could not save rules'),
  });

  const toggleRule = (id: string, enabled: boolean) => {
    setLocalRules(rules.map((r) => (r.id === id ? { ...r, enabled } : r)));
  };

  return (
    <FeatureModuleGuard module="TICKETS">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <SupportBackLink />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Automation rules</h1>
            <p className="text-muted-foreground mt-1">
              Auto-tag, notify, and route tickets when events occur — no code required.
              For custom event rules, use{' '}
              <Link
                href={path('/dashboard/workflows')}
                className="text-primary underline underline-offset-2"
              >
                Automations
              </Link>
              .
            </p>
          </div>
          <Button
            onClick={() => saveMutation.mutate(rules)}
            disabled={saveMutation.isPending || localRules === null}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save changes
          </Button>
        </div>

        {isLoading ? (
          <CardListSkeleton rows={4} />
        ) : isError ? (
          <Card>
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load automation rules"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => refetch()}
            />
          </Card>
        ) : rules.length === 0 ? (
          <Card>
            <EmptyState
              icon={Zap}
              title="No automation rules yet"
              description="Build custom event-driven rules in Automations."
              actionLabel="Open Automations"
              actionHref={path('/dashboard/workflows')}
            />
          </Card>
        ) : (
          <div className="grid gap-4">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        {rule.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        When{' '}
                        <Badge variant="outline">
                          {TRIGGER_LABELS[rule.trigger] ?? humanizeEnum(rule.trigger)}
                        </Badge>
                        {rule.conditions?.channel ? (
                          <>
                            {' '}on channel{' '}
                            <Badge variant="secondary">
                              {humanizeEnum(rule.conditions.channel, ENUM_LABEL_OVERRIDES)}
                            </Badge>
                          </>
                        ) : null}
                        {rule.conditions?.priority ? (
                          <>
                            {' '}with priority{' '}
                            <Badge variant="secondary">{humanizeEnum(rule.conditions.priority)}</Badge>
                          </>
                        ) : null}
                      </CardDescription>
                    </div>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) => toggleRule(rule.id, v)}
                      aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {rule.actions.map((action, i) => (
                      <li key={i}>
                        → {humanizeEnum(action.type)}
                        {'tag' in action ? `: ${action.tag}` : ''}
                        {'priority' in action ? `: ${humanizeEnum(action.priority)}` : ''}
                        {'title' in action ? `: ${action.title}` : ''}
                        {'groupName' in action ? `: ${action.groupName}` : ''}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Toggle rules on or off and save — changes apply immediately on the next ticket event.
            Default rules cover portal tagging, critical alerts, SLA at-risk warnings, and breach escalation.
          </CardContent>
        </Card>
      </div>
    </FeatureModuleGuard>
  );
}

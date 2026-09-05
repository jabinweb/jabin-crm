'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export type CompanyDatabaseStatus = {
  databaseMode: string;
  hasDatabaseUrl: boolean;
  databaseHostMasked: string | null;
  databaseConnectedAt: string | null;
  databaseLastHealthAt: string | null;
  databaseLastError: string | null;
  dataLocation: 'opslane' | 'company';
};

type Props = {
  /** When set, uses admin API for that company; otherwise session company API */
  companyId?: string;
  className?: string;
};

function statusVariant(
  mode: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (mode === 'BYO_ACTIVE') return 'default';
  if (mode === 'FAILED') return 'destructive';
  if (mode === 'MIGRATING' || mode === 'CONNECTING') return 'outline';
  return 'secondary';
}

export function CompanyDatabasePanel({ companyId, className }: Props) {
  const { toast } = useToast();
  const [status, setStatus] = useState<CompanyDatabaseStatus | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const endpoint = companyId
    ? `/api/admin/companies/${companyId}/database`
    : '/api/company/database';

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'Failed to load database status');
      }
      setStatus(json.data as CompanyDatabaseStatus);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [endpoint, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runAction = async (
    action: 'connect' | 'health' | 'disconnect' | 'migrate' | 'provision',
    extra?: { url?: string }
  ) => {
    setBusyAction(action);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Action ${action} failed`);
      }
      const next = json.data?.status ?? json.data;
      if (next?.databaseMode) setStatus(next as CompanyDatabaseStatus);
      else await refresh();
      if (action === 'connect') setUrl('');
      toast({
        title: 'Success',
        description:
          action === 'migrate'
            ? 'Migration completed. Data now lives on your database.'
            : `Database ${action} succeeded`,
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Action failed',
        variant: 'destructive',
      });
      await refresh();
    } finally {
      setBusyAction(null);
    }
  };

  const mode = status?.databaseMode ?? 'SHARED';
  const migrating = mode === 'MIGRATING';

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Company database</CardTitle>
          {status ? (
            <Badge variant={statusVariant(mode)}>{mode}</Badge>
          ) : null}
          {status ? (
            <Badge variant="outline">
              Data: {status.dataLocation === 'company' ? 'Your Postgres' : 'Opslane'}
            </Badge>
          ) : null}
        </div>
        <CardDescription>
          By default your data stays on Opslane. Connect your own Postgres to isolate it.
          Connecting a URL does not move data until you run Migrate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.databaseHostMasked ? (
          <p className="text-sm text-muted-foreground">
            Host: <span className="font-medium text-foreground">{status.databaseHostMasked}</span>
          </p>
        ) : null}
        {status?.databaseLastError ? (
          <p className="text-sm text-destructive">{status.databaseLastError}</p>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="byo-db-url">Postgres URL</Label>
          <Input
            id="byo-db-url"
            type="password"
            autoComplete="off"
            placeholder="postgresql://user:pass@host:5432/dbname"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={migrating || mode === 'BYO_ACTIVE'}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!url.trim() || !!busyAction || migrating || mode === 'BYO_ACTIVE'}
            onClick={() => runAction('connect', { url: url.trim() })}
          >
            {busyAction === 'connect' ? 'Connecting…' : 'Connect'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!status?.hasDatabaseUrl || !!busyAction || migrating}
            onClick={() => runAction('health')}
          >
            {busyAction === 'health' ? 'Checking…' : 'Health check'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!status?.hasDatabaseUrl || !!busyAction || migrating || mode === 'BYO_ACTIVE'}
            onClick={() => runAction('provision')}
          >
            {busyAction === 'provision' ? 'Provisioning…' : 'Provision schema'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={
              !status?.hasDatabaseUrl ||
              !!busyAction ||
              migrating ||
              mode === 'BYO_ACTIVE'
            }
            onClick={() => runAction('migrate')}
          >
            {busyAction === 'migrate' ? 'Migrating…' : 'Migrate'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={
              !status?.hasDatabaseUrl ||
              !!busyAction ||
              migrating ||
              mode === 'BYO_ACTIVE'
            }
            onClick={() => runAction('disconnect')}
          >
            {busyAction === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={loading || !!busyAction}
            onClick={() => refresh()}
          >
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Globe2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TenancyMode } from '@/lib/tenancy/mode';

type ConfigResponse = {
  tenancyMode: TenancyMode;
  source: 'database' | 'env';
  envTenancyMode: TenancyMode;
};

export function PlatformTenancySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<TenancyMode>('path');
  const [meta, setMeta] = useState<Omit<ConfigResponse, 'tenancyMode'> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/platform-settings');
        if (!res.ok) throw new Error('Failed to load');
        const data = (await res.json()) as ConfigResponse;
        if (cancelled) return;
        setMode(data.tenancyMode);
        setMeta({ source: data.source, envTenancyMode: data.envTenancyMode });
      } catch {
        toast.error('Could not load tenancy settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenancyMode: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMode(data.tenancyMode);
      setMeta({ source: data.source, envTenancyMode: data.envTenancyMode });
      toast.success('Tenancy mode saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe2 className="h-5 w-5" />
          Workspace URL mode
        </CardTitle>
        <CardDescription>
          Choose how company workspaces are addressed. Path-based works on free Vercel
          without a custom domain. Subdomain needs a domain + wildcard DNS later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as TenancyMode)}
              className="space-y-3"
            >
              <label
                htmlFor="tenancy-path"
                className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer has-[:checked]:border-foreground has-[:checked]:bg-muted/40"
              >
                <RadioGroupItem value="path" id="tenancy-path" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="tenancy-path" className="cursor-pointer font-medium">
                    Path-based (recommended for now)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    <code className="text-xs">yourapp.vercel.app/acme/dashboard</code>
                  </p>
                </div>
              </label>

              <label
                htmlFor="tenancy-subdomain"
                className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer has-[:checked]:border-foreground has-[:checked]:bg-muted/40"
              >
                <RadioGroupItem value="subdomain" id="tenancy-subdomain" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="tenancy-subdomain" className="cursor-pointer font-medium">
                    Subdomain-based
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    <code className="text-xs">acme.yourdomain.com/dashboard</code>
                    {' — '}
                    requires your own domain and <code className="text-xs">*.yourdomain.com</code>
                  </p>
                </div>
              </label>
            </RadioGroup>

            {meta && (
              <p className="text-xs text-muted-foreground">
                Active from <span className="font-medium">{meta.source}</span>
                {meta.source === 'database' ? (
                  <>
                    {' '}
                    (env default: <code>{meta.envTenancyMode}</code>)
                  </>
                ) : (
                  <>
                    {' '}
                    via <code>NEXT_PUBLIC_TENANCY_MODE</code>
                  </>
                )}
                . Set the env var on Vercel for a deploy-time default; this setting overrides it
                in the database.
              </p>
            )}

            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save tenancy mode
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

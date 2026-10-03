'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { FormSkeleton } from '@/components/loading';
import { confirmAction } from '@/lib/confirm-action';

type LiveKitSettingsResponse = {
  livekitUrl: string | null;
  livekitApiKey: string | null;
  livekitSecretSet: boolean;
  livekitSource: 'database' | 'env' | 'none';
  livekitConfigured: boolean;
};

const SOURCE_LABEL: Record<LiveKitSettingsResponse['livekitSource'], string> = {
  database: 'Saved here',
  env: 'From server environment',
  none: 'Not set up',
};

export function PlatformLiveKitSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [state, setState] = useState<LiveKitSettingsResponse | null>(null);

  const apply = (data: LiveKitSettingsResponse) => {
    setState(data);
    setUrl(data.livekitUrl ?? '');
    setApiKey(data.livekitApiKey ?? '');
    setSecret('');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/platform-settings');
        if (!res.ok) throw new Error('Failed to load');
        const data = (await res.json()) as LiveKitSettingsResponse;
        if (!cancelled) apply(data);
      } catch {
        toast.error('Could not load video settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const urlInvalid = url.trim() !== '' && !/^wss?:\/\/\S+$/.test(url.trim());
  // A secret must be saved with the key unless one is already stored
  const needsSecret = state?.livekitSource !== 'database' && !secret.trim();
  const canSave = !saving && !!url.trim() && !urlInvalid && !!apiKey.trim() && !needsSecret;

  const save = async (opts?: { clear?: boolean }) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = opts?.clear
        ? { clearLivekit: true }
        : {
            livekitUrl: url.trim(),
            livekitApiKey: apiKey.trim(),
            ...(secret.trim() ? { livekitApiSecret: secret.trim() } : {}),
          };
      const res = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const fieldError = data?.error?.fieldErrors
          ? Object.values(data.error.fieldErrors).flat()[0]
          : null;
        throw new Error((fieldError as string) || (typeof data.error === 'string' ? data.error : 'Save failed'));
      }
      apply(data);
      toast.success(opts?.clear ? 'Video settings removed' : 'Video settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <Video className="h-5 w-5" aria-hidden />
          Team meeting video (LiveKit)
          {state ? (
            <Badge variant={state.livekitConfigured ? 'default' : 'secondary'} className="font-normal">
              {state.livekitConfigured ? 'Active' : 'Off'} · {SOURCE_LABEL[state.livekitSource]}
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Powers built-in video for team meetings in every workspace. Without it, meetings use
          external links (Zoom, Meet, Teams). Values saved here take priority over server env vars.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <FormSkeleton fields={3} />
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSave) void save();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="livekit-url">Server URL</Label>
              <Input
                id="livekit-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="wss://livekit.your-domain.com"
                aria-invalid={urlInvalid}
                aria-describedby="livekit-url-hint"
              />
              <p
                id="livekit-url-hint"
                className={urlInvalid ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}
              >
                {urlInvalid
                  ? 'Use the websocket address, starting with wss://'
                  : 'LiveKit Cloud: wss://<project>.livekit.cloud'}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="livekit-key">API key</Label>
              <Input
                id="livekit-key"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="APIxxxxxxxx"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="livekit-secret">
                API secret
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {state?.livekitSource === 'database' ? '(saved — leave blank to keep)' : '(required)'}
                </span>
              </Label>
              <div className="relative">
                <Input
                  id="livekit-secret"
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={state?.livekitSource === 'database' ? '••••••••' : 'Secret for this key'}
                  autoComplete="new-password"
                  spellCheck={false}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={() => setShowSecret((v) => !v)}
                  aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                >
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored encrypted and never sent back to the browser.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!canSave}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save video settings
              </Button>
              {state?.livekitSource === 'database' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: 'Remove the saved video settings?',
                      description:
                        'Built-in video falls back to the server environment variables. If those are not set, new meetings can only use external links.',
                      confirmLabel: 'Remove',
                      variant: 'destructive',
                    });
                    if (ok) void save({ clear: true });
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

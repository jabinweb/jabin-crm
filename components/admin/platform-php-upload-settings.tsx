'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, HardDrive, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { FormSkeleton } from '@/components/loading';

type UploadSettingsResponse = {
  phpUploadUrl: string;
  phpUploadPasswordSet: boolean;
  phpUploadSource: 'database' | 'env' | 'default';
  phpUploadDefaultUrl: string;
};

export function PlatformPhpUploadSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [source, setSource] = useState<UploadSettingsResponse['phpUploadSource']>('default');
  const [defaultUrl, setDefaultUrl] = useState(
    'https://files.jabin.org/api/upload.php'
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/platform-settings');
        if (!res.ok) throw new Error('Failed to load');
        const data = (await res.json()) as UploadSettingsResponse;
        if (cancelled) return;
        setUrl(data.phpUploadUrl || data.phpUploadDefaultUrl);
        setPasswordSet(!!data.phpUploadPasswordSet);
        setSource(data.phpUploadSource);
        setDefaultUrl(data.phpUploadDefaultUrl);
      } catch {
        toast.error('Could not load file upload settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (opts?: { clearPassword?: boolean }) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        phpUploadUrl: url.trim() || defaultUrl,
      };
      if (opts?.clearPassword) {
        body.clearPhpUploadPassword = true;
      } else if (password.trim()) {
        body.phpUploadPassword = password.trim();
      }

      const res = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      setUrl(data.phpUploadUrl);
      setPasswordSet(!!data.phpUploadPasswordSet);
      setSource(data.phpUploadSource);
      setPassword('');
      toast.success(
        opts?.clearPassword
          ? 'Upload password cleared'
          : 'File upload settings saved to database'
      );
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
          <HardDrive className="h-5 w-5" />
          PHP file uploads
        </CardTitle>
        <CardDescription>
          Stored in the database for Super Admin — no deploy-time env required.
          Uploads POST to this URL with optional <code className="text-xs">password</code>{' '}
          form field / <code className="text-xs">X-Upload-Password</code> header.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <FormSkeleton fields={3} />
        ) : (
          <>
            <div className="grid gap-2">
              <Label htmlFor="php-upload-url">Upload URL</Label>
              <Input
                id="php-upload-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={defaultUrl}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="php-upload-password">
                Upload password
                {passwordSet ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (set — leave blank to keep)
                  </span>
                ) : (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (not set)
                  </span>
                )}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="php-upload-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={passwordSet ? '••••••••' : 'Shared secret for files.jabin.org'}
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Active from <span className="font-medium">{source}</span>
              {source !== 'database' ? (
                <>
                  {' '}
                  (save once to pin{' '}
                  <code className="text-xs">{defaultUrl}</code> in the DB)
                </>
              ) : null}
              . Password is never returned to the browser after save.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save upload settings
              </Button>
              {passwordSet ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => save({ clearPassword: true })}
                >
                  Clear password
                </Button>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

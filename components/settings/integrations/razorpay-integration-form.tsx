'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useSettings } from '@/contexts/settings-context';
import type { SettingsUpdatePayload } from '@/types/settings';

interface RazorpaySettings {
  enabled: boolean;
  mode: 'test' | 'live';
  credentials: {
    test: { keyId: string; keySecret: string; webhookSecret: string };
    live: { keyId: string; keySecret: string; webhookSecret: string };
  };
}

const DEFAULT_RAZORPAY: RazorpaySettings = {
  enabled: false,
  mode: 'test',
  credentials: {
    test: { keyId: '', keySecret: '', webhookSecret: '' },
    live: { keyId: '', keySecret: '', webhookSecret: '' },
  },
};

interface RazorpayIntegrationFormProps {
  onChange?: (changes: SettingsUpdatePayload) => void;
}

export function RazorpayIntegrationForm({ onChange }: RazorpayIntegrationFormProps) {
  const { settings } = useSettings();
  const [local, setLocal] = useState<RazorpaySettings>(DEFAULT_RAZORPAY);

  useEffect(() => {
    if (settings?.integrations?.razorpay) {
      setLocal(settings.integrations.razorpay);
    }
  }, [settings?.integrations?.razorpay]);

  const push = (updated: RazorpaySettings) => {
    setLocal(updated);
    onChange?.({
      settings: {
        integrations: { razorpay: updated },
      },
    });
  };

  const handleUpdate = (field: string, value: unknown) => {
    const currentMode = local.mode;

    if (['keyId', 'keySecret', 'webhookSecret'].includes(field)) {
      push({
        ...local,
        credentials: {
          ...local.credentials,
          [currentMode]: {
            ...local.credentials[currentMode],
            [field]: value as string,
          },
        },
      });
      return;
    }

    push({
      ...local,
      [field]: value,
    } as RazorpaySettings);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label>Enable Razorpay</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Used for payroll payouts and future client checkout on invoices.
          </p>
        </div>
        <Switch
          checked={local.enabled}
          onCheckedChange={(checked) => handleUpdate('enabled', checked)}
        />
      </div>

      {local.enabled && (
        <>
          <div className="grid gap-2 max-w-xs">
            <Label>Mode</Label>
            <Select
              value={local.mode}
              onValueChange={(value: 'test' | 'live') => handleUpdate('mode', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Key ID ({local.mode})</Label>
              <Input
                type="password"
                autoComplete="off"
                value={local.credentials[local.mode].keyId}
                onChange={(e) => handleUpdate('keyId', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Key secret ({local.mode})</Label>
              <Input
                type="password"
                autoComplete="off"
                value={local.credentials[local.mode].keySecret}
                onChange={(e) => handleUpdate('keySecret', e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Webhook secret ({local.mode})</Label>
              <Input
                type="password"
                autoComplete="off"
                value={local.credentials[local.mode].webhookSecret}
                onChange={(e) => handleUpdate('webhookSecret', e.target.value)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

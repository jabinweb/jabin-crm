'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/contexts/settings-context';
import type { SettingsUpdatePayload } from '@/types/company-manager/settings';
import { parseWorkspaceSettings, resolveWorkspaceConfig } from '@/lib/workspace-config';
import type { WorkspaceTerminology } from '@/lib/workspace-templates';
import { useMemo } from 'react';

const TERMINOLOGY_KEYS: Array<{ key: keyof WorkspaceTerminology; label: string; hint?: string }> = [
  { key: 'customer', label: 'Customer (singular)' },
  { key: 'customers', label: 'Customers (plural)' },
  { key: 'agent', label: 'Support agent', hint: 'Replaces "technician" in support contexts' },
  { key: 'asset', label: 'Asset' },
  { key: 'equipment', label: 'Equipment / assets nav label' },
  { key: 'ticket', label: 'Ticket / case label' },
  { key: 'newRequest', label: 'New request button' },
  { key: 'portalSubtitle', label: 'Portal dashboard subtitle' },
];

export function TerminologySection({
  onChange,
}: {
  onChange: (changes: SettingsUpdatePayload) => void;
}) {
  const { settings } = useSettings();

  const workspace = useMemo(() => {
    const raw = (settings as Record<string, unknown> | null)?.workspace;
    return parseWorkspaceSettings(raw);
  }, [settings]);

  const resolved = useMemo(() => resolveWorkspaceConfig(workspace), [workspace]);
  const overrides = workspace.terminologyOverrides ?? {};

  const updateTerm = (key: keyof WorkspaceTerminology, value: string) => {
    onChange({
      settings: {
        workspace: {
          ...workspace,
          terminologyOverrides: {
            ...overrides,
            [key]: value || undefined,
          },
        },
      } as SettingsUpdatePayload['settings'],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Terminology</CardTitle>
        <CardDescription>
          Customize labels shown in your workspace and customer portal. Template defaults from{' '}
          {resolved.verticalLabel} are shown as placeholders.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {TERMINOLOGY_KEYS.map(({ key, label, hint }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`term-${key}`}>{label}</Label>
            <Input
              id={`term-${key}`}
              placeholder={resolved.terminology[key]}
              value={overrides[key] ?? ''}
              onChange={(e) => updateTerm(key, e.target.value)}
            />
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

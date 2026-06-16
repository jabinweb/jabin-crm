'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/contexts/settings-context';
import type { SettingsUpdatePayload } from '@/types/company-manager/settings';
import {
  BUSINESS_VERTICAL_OPTIONS,
  WORKSPACE_TEMPLATES,
  type BusinessVertical,
  type WorkspaceFeatureKey,
} from '@/lib/workspace-templates';
import { parseWorkspaceSettings, resolveWorkspaceConfig } from '@/lib/workspace-config';
import { useMemo } from 'react';

const FEATURE_LABELS: Record<WorkspaceFeatureKey, string> = {
  customerPortal: 'Customer portal',
  customers: 'Customer records',
  customerAnalytics: 'Customer analytics',
  inventory: 'Inventory & products',
  equipment: 'Assets & equipment',
  fieldService: 'Field service operations',
  warranties: 'Warranties & coverage',
  serviceHistory: 'Service history',
  products: 'Product catalog',
};

export function WorkspaceSection({
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

  const updateWorkspace = (patch: Partial<typeof workspace>) => {
    onChange({
      settings: {
        workspace: {
          ...workspace,
          ...patch,
        },
      } as SettingsUpdatePayload['settings'],
    });
  };

  const setVertical = (vertical: BusinessVertical) => {
    const template = WORKSPACE_TEMPLATES[vertical];
    onChange({
      settings: {
        workspace: {
          businessVertical: vertical,
          featureOverrides: undefined,
        },
        leads: {
          statusFlow: template.leadStatusFlow,
        },
      } as SettingsUpdatePayload['settings'],
    });
  };

  const toggleFeature = (key: WorkspaceFeatureKey, enabled: boolean) => {
    updateWorkspace({
      featureOverrides: {
        ...(workspace.featureOverrides ?? {}),
        [key]: enabled,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business type</CardTitle>
          <CardDescription>
            Choose a template that matches your industry. Navigation, portal pages, and lead
            pipelines adapt automatically. You can fine-tune individual areas below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-vertical">Industry template</Label>
            <Select value={workspace.businessVertical} onValueChange={(v) => setVertical(v as BusinessVertical)}>
              <SelectTrigger id="business-vertical">
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_VERTICAL_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {WORKSPACE_TEMPLATES[workspace.businessVertical]?.description}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enabled areas</CardTitle>
          <CardDescription>
            Override which modules appear in your workspace. Subscription plan limits still apply
            for paid CRM and support features.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(FEATURE_LABELS) as WorkspaceFeatureKey[]).map((key) => (
            <div key={key} className="flex items-center justify-between gap-4 rounded-md border p-3">
              <Label htmlFor={`ws-feature-${key}`} className="text-sm font-normal">
                {FEATURE_LABELS[key]}
              </Label>
              <Switch
                id={`ws-feature-${key}`}
                checked={resolved.features[key] === true}
                onCheckedChange={(checked) => toggleFeature(key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

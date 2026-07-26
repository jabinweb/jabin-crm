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
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/contexts/settings-context';
import type { SettingsUpdatePayload } from '@/types/settings';
import {
  BUSINESS_VERTICAL_OPTIONS,
  WORKSPACE_TEMPLATES,
  type BusinessVertical,
  type WorkspaceFeatureKey,
} from '@/lib/workspace-templates';
import { parseWorkspaceSettings, resolveWorkspaceConfig, buildVerticalSwitchPatch } from '@/lib/workspace-config';
import { useMemo } from 'react';

const FEATURE_LABELS: Record<WorkspaceFeatureKey, string> = {
  customerPortal: 'Customer portal',
  customers: 'Customer records',
  customerAnalytics: 'Customer analytics',
  inventory: 'Inventory & stock',
  equipment: 'Installed equipment',
  fieldService: 'Field service operations',
  warranties: 'Warranties & coverage',
  serviceHistory: 'Service history',
  products: 'Product catalog',
};

const PACK_FEATURE_ORDER: WorkspaceFeatureKey[] = [
  'products',
  'inventory',
  'equipment',
  'fieldService',
  'warranties',
  'serviceHistory',
  'customerPortal',
  'customers',
  'customerAnalytics',
];

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

  const templateFeatures = useMemo(
    () => WORKSPACE_TEMPLATES[workspace.businessVertical]?.features,
    [workspace.businessVertical]
  );

  const packEnabled = useMemo(
    () => PACK_FEATURE_ORDER.filter((key) => templateFeatures?.[key] === true),
    [templateFeatures]
  );

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
    const patch = buildVerticalSwitchPatch(vertical);
    onChange({
      settings: patch as SettingsUpdatePayload['settings'],
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
            CRM, support, WhatsApp, and HRMS stay available based on your subscription plan.
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
          <div className="space-y-2">
            <p className="text-sm font-medium">This industry enables</p>
            {packEnabled.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Core CRM and support only — no inventory, equipment, or field ops by default.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {packEnabled.map((key) => (
                  <Badge key={key} variant="secondary">
                    {FEATURE_LABELS[key]}
                  </Badge>
                ))}
              </div>
            )}
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

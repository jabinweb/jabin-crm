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
  WORKSPACE_TEMPLATES,
  type WorkspaceFeatureKey,
} from '@/lib/workspace-templates';
import {
  INDUSTRY_PICKER_OPTIONS,
  getIndustryPickerOption,
} from '@/lib/industry-aliases';
import {
  parseWorkspaceSettings,
  resolveWorkspaceConfig,
  buildVerticalSwitchPatch,
  selectionIdForWorkspace,
} from '@/lib/workspace-config';
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
  const selectionId = selectionIdForWorkspace(workspace);
  const selectedOption = getIndustryPickerOption(selectionId);

  const packEnabled = useMemo(
    () => PACK_FEATURE_ORDER.filter((key) => resolved.features[key] === true),
    [resolved.features]
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

  const setIndustry = (selection: string) => {
    const patch = buildVerticalSwitchPatch(selection);
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

  const packLabel =
    WORKSPACE_TEMPLATES[resolved.businessVertical]?.label ?? resolved.businessVertical;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business type</CardTitle>
          <CardDescription>
            Choose an industry. Navigation, portal pages, and lead pipelines adapt via a deep
            product pack. CRM, support, WhatsApp, and HRMS stay available based on your plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-vertical">Industry</Label>
            <Select value={selectionId} onValueChange={setIndustry}>
              <SelectTrigger id="business-vertical">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_PICKER_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                    {option.deepTemplate ? ' · Deep template' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {selectedOption?.description ??
                WORKSPACE_TEMPLATES[workspace.businessVertical]?.description}
            </p>
            {selectedOption && selectedOption.pack !== selectedOption.id && (
              <p className="text-xs text-muted-foreground">
                Uses product pack: <span className="font-medium text-foreground">{packLabel}</span>
              </p>
            )}
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

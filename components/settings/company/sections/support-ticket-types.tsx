'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '@/contexts/settings-context';
import type { SettingsUpdatePayload } from '@/types/company-manager/settings';
import { parseWorkspaceSettings, resolveWorkspaceConfig } from '@/lib/workspace-config';
import {
  getDefaultTicketTypesForVertical,
  parseSupportSettings,
  resolvePortalTicketTypes,
  type PortalTicketField,
  type PortalTicketTypeDefinition,
  type SupportSettings,
} from '@/lib/support/ticket-types';
import { DEFAULT_STATUS_PIPELINE, STATUS_LABELS } from '@/lib/support/status-pipelines';
import { Plus, Trash2 } from 'lucide-react';

function slugifyId(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

export function SupportTicketTypesSection({
  onChange,
}: {
  onChange: (changes: SettingsUpdatePayload) => void;
}) {
  const { settings } = useSettings();
  const [draftType, setDraftType] = useState<Partial<PortalTicketTypeDefinition>>({
    label: '',
    description: '',
    defaultPriority: 'MEDIUM',
    fields: [],
  });

  const workspace = useMemo(() => {
    const raw = (settings as Record<string, unknown> | null)?.workspace;
    return parseWorkspaceSettings(raw);
  }, [settings]);

  const support = useMemo(() => {
    const raw = (settings as Record<string, unknown> | null)?.support;
    return parseSupportSettings(raw);
  }, [settings]);

  const resolved = useMemo(() => resolveWorkspaceConfig(workspace), [workspace]);
  const activeTypes = useMemo(
    () => resolvePortalTicketTypes(resolved, support),
    [resolved, support]
  );
  const allPresets = useMemo(
    () => getDefaultTicketTypesForVertical(resolved.businessVertical),
    [resolved.businessVertical]
  );

  const disabled = new Set(support.disabledTicketTypeIds ?? []);
  const customTypes = support.customTicketTypes ?? [];

  const updateSupport = (patch: Partial<SupportSettings>) => {
    onChange({
      settings: {
        support: {
          ...support,
          ...patch,
        },
      } as SettingsUpdatePayload['settings'],
    });
  };

  const toggleType = (typeId: string, enabled: boolean) => {
    const next = new Set(disabled);
    if (enabled) next.delete(typeId);
    else next.add(typeId);
    updateSupport({ disabledTicketTypeIds: Array.from(next) });
  };

  const addCustomType = () => {
    if (!draftType.label?.trim()) return;
    const id = slugifyId(draftType.label) || `custom_${Date.now()}`;
    const next: PortalTicketTypeDefinition = {
      id,
      label: draftType.label.trim(),
      description: draftType.description?.trim() || '',
      defaultPriority: draftType.defaultPriority ?? 'MEDIUM',
      groupName: draftType.groupName,
      fields: draftType.fields ?? [],
      showEquipment: draftType.showEquipment,
      showProduct: draftType.showProduct,
    };
    updateSupport({ customTicketTypes: [...customTypes, next] });
    setDraftType({ label: '', description: '', defaultPriority: 'MEDIUM', fields: [] });
  };

  const removeCustomType = (id: string) => {
    updateSupport({
      customTicketTypes: customTypes.filter((t) => t.id !== id),
    });
  };

  const updateSlaForType = (
    typeId: string,
    field: 'responseHours' | 'resolutionHours',
    value: number
  ) => {
    const current = support.slaByTicketType?.[typeId] ?? {
      responseHours: 4,
      resolutionHours: 48,
    };
    updateSupport({
      slaByTicketType: {
        ...support.slaByTicketType,
        [typeId]: { ...current, [field]: value },
      },
    });
  };

  const updateChannel = (key: keyof NonNullable<SupportSettings['channels']>, value: string | boolean) => {
    updateSupport({
      channels: {
        ...support.channels,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Portal request categories</CardTitle>
          <CardDescription>
            Enable preset categories for {resolved.verticalLabel}. Customers see {activeTypes.length}{' '}
            active type{activeTypes.length === 1 ? '' : 's'} in the portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {allPresets.map((type) => (
            <div
              key={type.id}
              className="flex items-start justify-between gap-4 rounded-md border p-3"
            >
              <div>
                <Label htmlFor={`ticket-type-${type.id}`} className="text-sm font-medium">
                  {type.label}
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">{type.description}</p>
              </div>
              <Switch
                id={`ticket-type-${type.id}`}
                checked={!disabled.has(type.id)}
                onCheckedChange={(checked) => toggleType(type.id, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom request types</CardTitle>
          <CardDescription>
            Add categories beyond the template presets. Each type can route to a support group by name.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customTypes.map((type) => (
            <div key={type.id} className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div>
                <p className="font-medium">{type.label}</p>
                <p className="text-xs text-muted-foreground">{type.description || type.id}</p>
                {type.groupName ? (
                  <p className="text-xs text-muted-foreground mt-1">Group: {type.groupName}</p>
                ) : null}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomType(type.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="grid gap-3 sm:grid-cols-2 rounded-md border border-dashed p-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Label</Label>
              <Input
                value={draftType.label ?? ''}
                onChange={(e) => setDraftType((d) => ({ ...d, label: e.target.value }))}
                placeholder="e.g. Partnership inquiry"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={draftType.description ?? ''}
                onChange={(e) => setDraftType((d) => ({ ...d, description: e.target.value }))}
                placeholder="Shown to customers when selecting this category"
              />
            </div>
            <div className="space-y-2">
              <Label>Support group name</Label>
              <Input
                value={draftType.groupName ?? ''}
                onChange={(e) => setDraftType((d) => ({ ...d, groupName: e.target.value }))}
                placeholder="General Support"
              />
            </div>
            <div className="space-y-2">
              <Label>Default priority</Label>
              <Select
                value={draftType.defaultPriority ?? 'MEDIUM'}
                onValueChange={(v) =>
                  setDraftType((d) => ({
                    ...d,
                    defaultPriority: v as PortalTicketTypeDefinition['defaultPriority'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="button" variant="secondary" onClick={addCustomType}>
                <Plus className="mr-2 h-4 w-4" />
                Add custom type
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SLA by category</CardTitle>
          <CardDescription>
            Override response and resolution targets for specific request types.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeTypes.slice(0, 8).map((type) => {
            const sla = support.slaByTicketType?.[type.id];
            return (
              <div key={type.id} className="grid gap-2 sm:grid-cols-3 items-end rounded-md border p-3">
                <p className="text-sm font-medium sm:col-span-1">{type.label}</p>
                <div className="space-y-1">
                  <Label className="text-xs">Response (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={sla?.responseHours ?? ''}
                    placeholder="4"
                    onChange={(e) =>
                      updateSlaForType(type.id, 'responseHours', Number(e.target.value) || 4)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Resolution (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={sla?.resolutionHours ?? ''}
                    placeholder="48"
                    onChange={(e) =>
                      updateSlaForType(type.id, 'resolutionHours', Number(e.target.value) || 48)
                    }
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portal support channels</CardTitle>
          <CardDescription>
            Contact options shown on the customer Help &amp; support hub.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Support email</Label>
            <Input
              type="email"
              value={support.channels?.email ?? ''}
              onChange={(e) => updateChannel('email', e.target.value)}
              placeholder="support@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Support phone</Label>
            <Input
              value={support.channels?.phone ?? ''}
              onChange={(e) => updateChannel('phone', e.target.value)}
              placeholder="+1 555 0100"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Live chat</Label>
            <Switch
              checked={support.channels?.chat === true}
              onCheckedChange={(checked) => updateChannel('chat', checked)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>WhatsApp</Label>
            <Switch
              checked={support.channels?.whatsApp === true}
              onCheckedChange={(checked) => updateChannel('whatsApp', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status pipeline</CardTitle>
          <CardDescription>
            Default lifecycle: {DEFAULT_STATUS_PIPELINE.map((s) => STATUS_LABELS[s]).join(' → ')}.
            Per-type pipelines can be configured via company settings JSON.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

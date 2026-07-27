'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/settings-context';
import type { SettingsUpdatePayload } from '@/types/settings';
import { DEFAULT_FIELD_OPS_SETTINGS, parseFieldOpsSettings } from '@/lib/crm/field-ops-settings';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface FieldOpsSectionProps {
  onChange?: (changes: SettingsUpdatePayload) => void;
}

export function FieldOpsSection({ onChange }: FieldOpsSectionProps) {
  const { settings } = useSettings();
  const fieldOps = parseFieldOpsSettings(
    (settings as unknown as Record<string, unknown> | null | undefined)?.fieldOps
  );

  const patch = (partial: Record<string, unknown>) => {
    onChange?.({
      settings: {
        fieldOps: {
          ...fieldOps,
          ...partial,
          geoFence: {
            ...fieldOps.geoFence,
            ...((partial.geoFence as object) || {}),
          },
        },
      } as SettingsUpdatePayload['settings'],
    });
  };

  const captureOfficeLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported in this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        patch({
          geoFence: {
            ...fieldOps.geoFence,
            enabled: true,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
        });
        toast.success('Office location captured — save settings to apply');
      },
      () => toast.error('Could not get current location'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Field operations</CardTitle>
        <CardDescription>
          Visit limits, photo evidence, and attendance geo-fence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Enforce contract visit limits</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Block resolve/close when linked contract is over its visit limit.
            </p>
          </div>
          <Switch
            checked={fieldOps.enforceVisitLimits}
            onCheckedChange={(checked) => patch({ enforceVisitLimits: checked })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Require photo evidence</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tickets need at least one photo before resolve/close.
            </p>
          </div>
          <Switch
            checked={fieldOps.requirePhotoEvidence}
            onCheckedChange={(checked) => patch({ requirePhotoEvidence: checked })}
          />
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Attendance geo-fence</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Flag punches outside the office radius.
              </p>
            </div>
            <Switch
              checked={fieldOps.geoFence.enabled}
              onCheckedChange={(checked) =>
                patch({ geoFence: { ...fieldOps.geoFence, enabled: checked } })
              }
            />
          </div>

          {fieldOps.geoFence.enabled ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={fieldOps.geoFence.lat ?? ''}
                    onChange={(e) =>
                      patch({
                        geoFence: {
                          ...fieldOps.geoFence,
                          lat: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={fieldOps.geoFence.lng ?? ''}
                    onChange={(e) =>
                      patch({
                        geoFence: {
                          ...fieldOps.geoFence,
                          lng: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Radius (meters)</Label>
                  <Input
                    type="number"
                    min={50}
                    value={fieldOps.geoFence.radiusMeters}
                    onChange={(e) =>
                      patch({
                        geoFence: {
                          ...fieldOps.geoFence,
                          radiusMeters: Number(e.target.value) || DEFAULT_FIELD_OPS_SETTINGS.geoFence.radiusMeters,
                        },
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={fieldOps.geoFence.hardBlock}
                    onCheckedChange={(checked) =>
                      patch({ geoFence: { ...fieldOps.geoFence, hardBlock: checked } })
                    }
                  />
                  <Label className="text-sm">Hard-block punches outside fence</Label>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={captureOfficeLocation}>
                  <MapPin className="h-3.5 w-3.5 mr-1.5" />
                  Use my location
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

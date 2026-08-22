'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { SupportBackLink } from '@/components/support/support-back-link';
import { DetailSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import type { BusinessHoursConfig } from '@/lib/crm/business-hours';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BusinessHoursPage() {
  const queryClient = useQueryClient();
  const { slug, workspaceFetch } = useWorkspacePaths();
  const [config, setConfig] = useState<BusinessHoursConfig | null>(null);
  const [holidaysText, setHolidaysText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['business-hours', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/business-hours');
      if (!res.ok) throw new Error('Failed to load');
      return res.json() as Promise<BusinessHoursConfig>;
    },
  });

  useEffect(() => {
    if (data) {
      setConfig(data);
      setHolidaysText((data.holidays || []).join(', '));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!config) return;
      const holidays = holidaysText
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
      const res = await workspaceFetch('/api/support/business-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, holidays }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Business hours saved');
      queryClient.invalidateQueries({ queryKey: ['business-hours'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !config) {
    return (
      <div className="space-y-6 max-w-3xl">
        <SupportBackLink />
        <DetailSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <SupportBackLink />
        <div>
          <h1 className="text-2xl font-bold">Business hours</h1>
          <p className="text-sm text-muted-foreground">
            SLA clocks pause outside these hours when enabled
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
              id="bh-enabled"
            />
            <Label htmlFor="bh-enabled">Enforce business hours for SLA</Label>
          </div>
          <div>
            <Label>Timezone</Label>
            <Input
              value={config.timezone || ''}
              onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
              placeholder="Asia/Kolkata"
            />
          </div>
          <div className="space-y-3">
            {DAY_LABELS.map((label, day) => {
              const slot = config.weekly[day];
              const open = !!slot;
              return (
                <div
                  key={day}
                  className="flex flex-wrap items-center gap-3 border rounded-lg p-3"
                >
                  <span className="w-10 text-sm font-medium">{label}</span>
                  <Switch
                    checked={open}
                    onCheckedChange={(checked) => {
                      setConfig({
                        ...config,
                        weekly: {
                          ...config.weekly,
                          [day]: checked
                            ? { start: '09:00', end: '18:00' }
                            : null,
                        },
                      });
                    }}
                  />
                  {open && slot ? (
                    <>
                      <Input
                        type="time"
                        className="w-[120px]"
                        value={slot.start}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            weekly: {
                              ...config.weekly,
                              [day]: { ...slot, start: e.target.value },
                            },
                          })
                        }
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="time"
                        className="w-[120px]"
                        value={slot.end}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            weekly: {
                              ...config.weekly,
                              [day]: { ...slot, end: e.target.value },
                            },
                          })
                        }
                      />
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <Label>Holidays (YYYY-MM-DD, comma-separated)</Label>
            <Input
              value={holidaysText}
              onChange={(e) => setHolidaysText(e.target.value)}
              placeholder="2026-01-26, 2026-08-15"
            />
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

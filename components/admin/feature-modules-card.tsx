'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FEATURE_MODULE_LABELS, type FeatureModuleKey } from '@/lib/feature-module-keys';
import { FormSkeleton } from '@/components/loading';
import { Loader2 } from 'lucide-react';

export function FeatureModulesCard({ userId }: { userId: string }) {
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [planModules, setPlanModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadModules = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/features`);
      if (!res.ok) throw new Error('Failed to fetch modules');
      const data = await res.json();
      setModules(data.modules || {});
      setPlanModules(data.planModules || {});
    } catch {
      toast.error('Failed to load feature modules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, [userId]);

  const saveModules = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(modules).map(([module, enabled]) => ({ module, enabled }));
      const res = await fetch(`/api/admin/users/${userId}/features`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: payload }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Feature modules updated');
      await loadModules();
    } catch {
      toast.error('Failed to update feature modules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Modules</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <FormSkeleton fields={4} />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Toggles apply on top of the user&apos;s subscription plan. Modules not included in the plan cannot be enabled.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(FEATURE_MODULE_LABELS).map((module) => {
                const key = module as FeatureModuleKey;
                const planAllowed = planModules[key] === true;
                return (
                  <div key={module} className="flex items-center justify-between p-3 rounded border">
                    <div className="space-y-1">
                      <Label htmlFor={`module-${module}`}>{FEATURE_MODULE_LABELS[key]}</Label>
                      {!planAllowed && (
                        <Badge variant="secondary" className="text-[10px]">
                          Not on plan
                        </Badge>
                      )}
                    </div>
                    <Switch
                      id={`module-${module}`}
                      checked={modules[module] === true}
                      disabled={!planAllowed}
                      onCheckedChange={(checked) => setModules((prev) => ({ ...prev, [module]: checked }))}
                    />
                  </div>
                );
              })}
            </div>
            <Button onClick={saveModules} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save Module Access'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

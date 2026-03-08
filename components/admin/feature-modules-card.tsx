'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MODULE_LABELS: Record<string, string> = {
  LEADS: 'Leads',
  DEALS: 'Deals',
  QUOTATIONS: 'Quotations',
  INVOICES: 'Invoices',
  TICKETS: 'Tickets',
  SERVICE_REPORTS: 'Service Reports',
  SERVICE_CASH: 'Service Cash',
  SERVICE_EXPENSES: 'Service Expenses',
  SERVICE_GPS: 'Service GPS',
  WHATSAPP: 'WhatsApp',
  EMAIL_OUTREACH: 'Email Outreach',
};

export function FeatureModulesCard({ userId }: { userId: string }) {
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadModules = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/features`);
      if (!res.ok) throw new Error('Failed to fetch modules');
      const data = await res.json();
      setModules(data.modules || {});
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
          <p className="text-sm text-muted-foreground">Loading modules...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(MODULE_LABELS).map((module) => (
                <div key={module} className="flex items-center justify-between p-3 rounded border">
                  <Label htmlFor={`module-${module}`}>{MODULE_LABELS[module]}</Label>
                  <Switch
                    id={`module-${module}`}
                    checked={modules[module] !== false}
                    onCheckedChange={(checked) => setModules((prev) => ({ ...prev, [module]: checked }))}
                  />
                </div>
              ))}
            </div>
            <Button onClick={saveModules} disabled={saving}>
              {saving ? 'Saving...' : 'Save Module Access'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

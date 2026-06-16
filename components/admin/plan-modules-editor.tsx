'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ALL_FEATURE_MODULES,
  FEATURE_MODULE_LABELS,
  type FeatureModuleKey,
} from '@/lib/feature-module-keys';

export function PlanModulesEditor({
  modules,
  onChange,
}: {
  modules: Record<string, boolean>;
  onChange: (modules: Record<string, boolean>) => void;
}) {
  return (
    <div className="space-y-3">
      <Label>CRM & support modules included in this plan</Label>
      <p className="text-xs text-muted-foreground">
        HRMS (attendance, payroll, leave) is always on for company workspaces and is not
        controlled by plans.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto border rounded-md p-3">
        {ALL_FEATURE_MODULES.map((module) => (
          <div key={module} className="flex items-center justify-between gap-2">
            <Label htmlFor={`plan-module-${module}`} className="text-sm font-normal">
              {FEATURE_MODULE_LABELS[module as FeatureModuleKey]}
            </Label>
            <Switch
              id={`plan-module-${module}`}
              checked={modules[module] === true}
              onCheckedChange={(checked) =>
                onChange({ ...modules, [module]: checked })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { Button } from '@/components/ui/button';
import type { FeatureModuleKey } from '@/lib/feature-module-keys';

type ModuleMap = Partial<Record<FeatureModuleKey, boolean>>;

let cachedModules: ModuleMap | null = null;
let cachePromise: Promise<ModuleMap> | null = null;

async function fetchModules(): Promise<ModuleMap> {
  if (cachedModules) return cachedModules;
  if (!cachePromise) {
    cachePromise = fetch('/api/features/me')
      .then((res) => (res.ok ? res.json() : { modules: {} }))
      .then((data) => {
        cachedModules = data.modules ?? {};
        return cachedModules!;
      })
      .catch(() => ({}));
  }
  return cachePromise;
}

export function useFeatureModule(module: FeatureModuleKey) {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetchModules().then((modules) => setEnabled(modules[module] === true));
  }, [module]);

  return enabled;
}

export function FeatureModuleGuard({
  module,
  children,
  title = 'Upgrade required',
}: {
  module: FeatureModuleKey;
  children: React.ReactNode;
  title?: string;
}) {
  const enabled = useFeatureModule(module);

  if (enabled === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">
          This feature is not included in your current subscription plan. Upgrade to unlock it for your team.
        </p>
        <Button asChild>
          <DashboardLink href="/dashboard/settings/subscription">View plans</DashboardLink>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

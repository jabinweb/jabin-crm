'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { Button } from '@/components/ui/button';
import type { FeatureModuleKey } from '@/lib/feature-module-keys';

type ModuleMap = Partial<Record<FeatureModuleKey, boolean>>;

let cachedModules: ModuleMap | null = null;
let fetchFailed = false;
let cachePromise: Promise<ModuleMap> | null = null;

export function didFeatureModulesFetchFail() {
  return fetchFailed;
}

/** Shared module map fetch — one in-flight request for sidebar + guards. */
export async function fetchFeatureModules(): Promise<ModuleMap> {
  if (cachedModules !== null && !fetchFailed) return cachedModules;
  if (!cachePromise) {
    cachePromise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6_000);
      try {
        const res = await fetch('/api/features/me', { signal: controller.signal });
        if (!res.ok) {
          fetchFailed = true;
          cachedModules = null;
          return {};
        }
        const data = await res.json();
        fetchFailed = false;
        // Support both flat and `{ data: { modules } }` response shapes.
        cachedModules = data.modules ?? data.data?.modules ?? {};
        return cachedModules!;
      } catch {
        fetchFailed = true;
        cachedModules = null;
        return {};
      } finally {
        clearTimeout(timer);
        cachePromise = null;
      }
    })();
  }
  return cachePromise;
}

export function useFeatureModule(module: FeatureModuleKey) {
  const [enabled, setEnabled] = useState<boolean | null>(() => {
    if (fetchFailed) return true;
    if (cachedModules !== null) return cachedModules[module] === true;
    return null;
  });

  useEffect(() => {
    let cancelled = false;
    fetchFeatureModules().then(() => {
      if (!cancelled) {
        setEnabled(fetchFailed || cachedModules?.[module] === true);
      }
    });
    return () => {
      cancelled = true;
    };
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

  // While modules are loading, render children so pages can start their own
  // data fetches immediately (avoids skeleton → skeleton and sequential waits).
  if (enabled === false) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">
          This feature is not included in your current subscription plan. Upgrade to unlock it for
          your team.
        </p>
        <Button asChild>
          <DashboardLink href="/dashboard/settings/subscription">View plans</DashboardLink>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

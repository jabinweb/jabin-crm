'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

/** Same plan module as the nav item, so deep links show the upgrade state instead of failing APIs. */
export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureModuleGuard module="INVENTORY" title="Suppliers not available">
      {children}
    </FeatureModuleGuard>
  );
}

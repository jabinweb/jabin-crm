'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function CompanyLeadsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="LEADS" title="Leads not available">{children}</FeatureModuleGuard>;
}

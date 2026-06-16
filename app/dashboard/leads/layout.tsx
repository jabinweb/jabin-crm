'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="LEADS">{children}</FeatureModuleGuard>;
}

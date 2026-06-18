'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function ServiceReportsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="SERVICE_REPORTS">{children}</FeatureModuleGuard>;
}

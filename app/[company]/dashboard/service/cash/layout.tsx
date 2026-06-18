'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function ServiceCashLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="SERVICE_CASH">{children}</FeatureModuleGuard>;
}

'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function QuotationsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="QUOTATIONS">{children}</FeatureModuleGuard>;
}

'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="DEALS">{children}</FeatureModuleGuard>;
}

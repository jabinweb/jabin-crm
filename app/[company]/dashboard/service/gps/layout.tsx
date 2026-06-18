'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function ServiceGpsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="SERVICE_GPS">{children}</FeatureModuleGuard>;
}

'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="TICKETS">{children}</FeatureModuleGuard>;
}

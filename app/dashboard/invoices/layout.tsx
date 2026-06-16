'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="INVOICES">{children}</FeatureModuleGuard>;
}

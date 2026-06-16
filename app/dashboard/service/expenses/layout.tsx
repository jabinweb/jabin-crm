'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function ServiceExpensesLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="SERVICE_EXPENSES">{children}</FeatureModuleGuard>;
}

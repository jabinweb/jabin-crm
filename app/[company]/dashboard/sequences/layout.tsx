'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function SequencesLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="EMAIL_OUTREACH">{children}</FeatureModuleGuard>;
}

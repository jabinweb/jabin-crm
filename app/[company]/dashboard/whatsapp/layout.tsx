'use client';

import { FeatureModuleGuard } from '@/components/feature-module-guard';

export default function WhatsAppLayout({ children }: { children: React.ReactNode }) {
  return <FeatureModuleGuard module="WHATSAPP">{children}</FeatureModuleGuard>;
}

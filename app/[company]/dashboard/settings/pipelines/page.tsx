'use client';

import { DashboardPage } from '@/components/layout/dashboard-page';
import { PipelineSettingsPanel } from '@/components/pipelines/pipeline-settings';

export default function PipelinesSettingsPage() {
  return (
    <DashboardPage>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipelines</h1>
        <p className="text-sm text-muted-foreground">
          Configure board columns for leads, deals, tickets, and procurement.
        </p>
      </div>
      <PipelineSettingsPanel />
    </DashboardPage>
  );
}

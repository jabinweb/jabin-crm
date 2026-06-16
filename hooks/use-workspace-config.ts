'use client';

import { useQuery } from '@tanstack/react-query';
import type { ResolvedWorkspaceConfig, WorkspaceSettings } from '@/lib/workspace-config';
import type { BusinessVertical } from '@/lib/workspace-templates';

export interface WorkspaceConfigResponse {
  workspace: WorkspaceSettings;
  config: ResolvedWorkspaceConfig;
  templates: Array<{ id: BusinessVertical; label: string; description: string }>;
}

export function useWorkspaceConfig() {
  return useQuery({
    queryKey: ['workspace-config'],
    queryFn: async (): Promise<WorkspaceConfigResponse> => {
      const res = await fetch('/api/workspace/config');
      if (!res.ok) {
        throw new Error('Failed to load workspace configuration');
      }
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useWorkspaceFeatures() {
  const { data } = useWorkspaceConfig();
  return data?.config.features ?? null;
}

export function useWorkspaceTerminology() {
  const { data } = useWorkspaceConfig();
  return data?.config.terminology ?? null;
}

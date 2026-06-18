'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import type { ResolvedWorkspaceConfig, WorkspaceSettings } from '@/lib/workspace-config';
import type { BusinessVertical } from '@/lib/workspace-templates';
import type { SupportSettings } from '@/lib/support/ticket-types';

export interface WorkspaceConfigResponse {
  workspace: WorkspaceSettings;
  config: ResolvedWorkspaceConfig;
  templates: Array<{ id: BusinessVertical; label: string; description: string }>;
  support?: SupportSettings;
  companyName?: string;
}

async function fetchWorkspaceConfig(isCustomer: boolean): Promise<WorkspaceConfigResponse> {
  const endpoint = isCustomer ? '/api/portal/workspace-config' : '/api/workspace/config';
  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error('Failed to load workspace configuration');
  }
  return res.json();
}

export function useWorkspaceConfig() {
  const { data: session } = useSession();
  const isCustomer = session?.user?.role === 'CUSTOMER';

  return useQuery({
    queryKey: ['workspace-config', isCustomer ? 'portal' : 'staff'],
    queryFn: () => fetchWorkspaceConfig(!!isCustomer),
    staleTime: 60_000,
    enabled: !!session?.user,
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

'use client';

import { useParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { tenantDashboardPath, tenantEmployeePath } from '@/lib/routing/paths';
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug';

/**
 * Company slug from `/[company]/...` routes plus helpers for scoped paths and API calls.
 */
export function useWorkspacePaths() {
  const params = useParams<{ company?: string }>();
  const slug = typeof params?.company === 'string' ? params.company : undefined;

  const path = useCallback(
    (dashboardPath: string) => tenantDashboardPath(slug, dashboardPath),
    [slug]
  );

  const employeePath = useCallback(
    (employeeRelativePath: string) => tenantEmployeePath(slug, employeeRelativePath),
    [slug]
  );

  const workspaceFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (slug) {
        for (const [key, value] of Object.entries(workspaceSlugHeaders(slug))) {
          headers.set(key, String(value));
        }
      }
      return fetch(input, { ...init, headers });
    },
    [slug]
  );

  return useMemo(
    () => ({ slug, path, employeePath, workspaceFetch, isScoped: !!slug }),
    [slug, path, employeePath, workspaceFetch]
  );
}

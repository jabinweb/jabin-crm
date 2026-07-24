'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import type { PipelineKind, PipelineStageDef } from '@/lib/pipelines';

export function usePipelineColumns(kind: PipelineKind) {
  const { workspaceFetch } = useWorkspacePaths();
  const [columns, setColumns] = useState<PipelineStageDef[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workspaceFetch('/api/workspace/pipelines');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setColumns(data.pipelines?.[kind]?.columns ?? []);
    } catch {
      setColumns([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceFetch, kind]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { columns, loading, reload };
}

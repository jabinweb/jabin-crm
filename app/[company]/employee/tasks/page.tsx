'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { PageHeaderSkeleton } from '@/components/loading';

/** Bookmark alias → delivery My work (ProjectTasks). */
export default function EmployeeTasksRedirectPage() {
  const router = useRouter();
  const { path } = useWorkspacePaths();

  useEffect(() => {
    router.replace(path('/dashboard/projects/my-work'));
  }, [router, path]);

  return (
    <div className="container mx-auto p-8">
      <PageHeaderSkeleton />
    </div>
  );
}

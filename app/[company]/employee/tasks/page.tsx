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
    <div className="mx-auto w-full max-w-lg lg:mx-0 lg:max-w-3xl">
      <PageHeaderSkeleton />
    </div>
  );
}

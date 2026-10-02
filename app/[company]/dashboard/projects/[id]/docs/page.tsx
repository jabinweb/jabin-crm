'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { DetailChrome } from '@/components/layout/detail-chrome';
import { ProjectDocs } from '@/components/projects/project-docs';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export default function ProjectDocsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { slug, path, workspaceFetch } = useWorkspacePaths();

  // Shares the cache entry with the docs tree — only used for the breadcrumb label
  const { data } = useQuery({
    queryKey: ['project-docs', slug, projectId],
    queryFn: async () => {
      const res = await workspaceFetch(`/api/projects/${projectId}/docs`);
      if (!res.ok) throw new Error('Failed to load docs');
      return (await res.json()) as { project: { id: string; name: string } };
    },
    enabled: !!slug && !!projectId,
  });

  const projectHref = path(`/dashboard/projects/${projectId}`);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DetailChrome
        crumbs={[
          { label: 'Projects', href: path('/dashboard/projects') },
          { label: data?.project.name ?? 'Project', href: projectHref },
          { label: 'Docs' },
        ]}
        backHref={projectHref}
        backLabel="Back to project"
      />
      <Suspense fallback={null}>
        <ProjectDocs projectId={projectId} />
      </Suspense>
    </div>
  );
}

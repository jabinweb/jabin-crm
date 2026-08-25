'use client';

import { useParams } from 'next/navigation';
import { StatusPage } from '@/components/layout/status-page';

export default function CompanyNotFound() {
  const params = useParams<{ company?: string }>();
  const slug = typeof params?.company === 'string' ? params.company : null;

  return (
    <StatusPage
      code="404"
      title="Workspace not found"
      description={
        slug
          ? `We couldn't find an active workspace at "${slug}". Check the URL or pick another workspace.`
          : "We couldn't find that workspace. It may have been removed or you don't have access."
      }
      primaryAction={{ label: 'Choose workspace', href: '/workspace' }}
      secondaryAction={{ label: 'Homepage', href: '/' }}
    />
  );
}

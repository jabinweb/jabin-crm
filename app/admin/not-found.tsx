import { StatusPage } from '@/components/layout/status-page';

export default function AdminNotFound() {
  return (
    <StatusPage
      code="404"
      title="Admin page not found"
      description="This platform admin page doesn't exist or you don't have permission to view it."
      primaryAction={{ label: 'Admin home', href: '/admin' }}
      secondaryAction={{ label: 'Workspace', href: '/workspace' }}
    />
  );
}

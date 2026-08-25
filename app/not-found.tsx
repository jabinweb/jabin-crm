import { StatusPage } from '@/components/layout/status-page';

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist, was moved, or you don't have access to it."
      primaryAction={{ label: 'Open workspace', href: '/workspace' }}
      secondaryAction={{ label: 'Homepage', href: '/' }}
    />
  );
}

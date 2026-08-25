import { StatusPage } from '@/components/layout/status-page';

export default function PortalNotFound() {
  return (
    <StatusPage
      code="404"
      title="Portal page not found"
      description="This client portal page doesn't exist or is no longer available."
      primaryAction={{ label: 'Portal home', href: '/portal' }}
      secondaryAction={{ label: 'Sign in', href: '/auth/signin' }}
    />
  );
}

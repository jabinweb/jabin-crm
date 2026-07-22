'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug';
import { canManageCompanyOnboarding } from '@/lib/onboarding/company-onboarding';

/** Redirect workspace admins to onboarding until completed. Staff are never forced. */
export function OnboardingRedirect() {
  const params = useParams<{ company?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const slug = params.company;
  const role = session?.user?.role;
  const isManager = canManageCompanyOnboarding(role);

  const { data } = useQuery({
    queryKey: ['onboarding-check', slug],
    queryFn: async () => {
      const res = await fetch('/api/onboarding', { headers: workspaceSlugHeaders(slug!) });
      if (!res.ok) return { onboarding: { completed: true } };
      return res.json();
    },
    enabled:
      status === 'authenticated' &&
      !!slug &&
      isManager &&
      !!pathname?.includes('/dashboard'),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isManager || !slug || !data || data.onboarding?.completed !== false) return;
    if (pathname?.includes('/onboarding')) return;
    router.replace(`/${slug}/onboarding`);
  }, [isManager, slug, data, pathname, router]);

  return null;
}

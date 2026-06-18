'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug';

/** Redirect new workspaces to onboarding until completed. */
export function OnboardingRedirect() {
  const params = useParams<{ company?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const slug = params.company;

  const { data } = useQuery({
    queryKey: ['onboarding-check', slug],
    queryFn: async () => {
      const res = await fetch('/api/onboarding', { headers: workspaceSlugHeaders(slug!) });
      if (!res.ok) return { onboarding: { completed: true } };
      return res.json();
    },
    enabled: status === 'authenticated' && !!slug && pathname?.includes('/dashboard'),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!slug || !data || data.onboarding?.completed !== false) return;
    if (pathname?.includes('/onboarding')) return;
    router.replace(`/${slug}/onboarding`);
  }, [slug, data, pathname, router]);

  return null;
}

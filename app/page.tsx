'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LandingPage } from '@/components/landing/landing-page';
import { AppLoader } from '@/components/loading';
import { resolvePostLoginPath } from '@/lib/auth/post-login-path';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (status === 'loading' || !session || redirected.current) return;

    redirected.current = true;
    const role = session.user.role;

    if (role === 'CUSTOMER') {
      router.replace('/portal');
    } else {
      router.replace(
        resolvePostLoginPath({
          role,
          companySlug: (session.user as { companySlug?: string }).companySlug,
        })
      );
    }
  }, [session, status, router]);

  if (status === 'loading' || session) {
    return <AppLoader />;
  }

  return <LandingPage />;
}

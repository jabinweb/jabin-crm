'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LandingPage } from '@/components/landing/landing-page';
import { resolvePostLoginPath } from '@/lib/auth/post-login-path';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading' || !session) return;

    const role = session.user.role;

    if (role === 'CUSTOMER') {
      router.push('/portal');
    } else {
      router.push(
        resolvePostLoginPath({
          role,
          companySlug: (session.user as { companySlug?: string }).companySlug,
        })
      );
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-px bg-foreground animate-pulse" />
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-px bg-foreground animate-pulse" />
      </div>
    );
  }

  return <LandingPage />;
}

'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LandingPage } from '@/components/landing/landing-page';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading' || !session) return;

    const role = session.user.role;
    const companySlug = (session.user as { companySlug?: string }).companySlug?.trim();

    if (role === 'CUSTOMER') {
      router.push('/portal');
    } else if (role === 'SUPER_ADMIN') {
      router.push('/admin');
    } else if (companySlug) {
      router.push(`/${companySlug}/dashboard`);
    } else {
      router.push('/dashboard');
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

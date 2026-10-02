'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { AppLoader } from '@/components/loading';
import { resolvePostLoginPath } from '@/lib/auth/post-login-path';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading' || !session?.user) return;

    // Same landing as the proxy, '/' and the navbar logo (technicians → their field
    // queue, super admins → the console); stay here only when there is no workspace yet.
    const target = resolvePostLoginPath({
      role: session.user.role,
      companySlug: session.user.companySlug,
    });
    if (target !== '/workspace') {
      router.replace(target);
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return <AppLoader />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-[100dvh] bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

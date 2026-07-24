'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { ShellSkeleton } from '@/components/loading';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading' || !session?.user) return;

    const slug = session.user.companySlug?.trim();
    if (session.user.role === 'CUSTOMER') {
      router.replace('/portal');
      return;
    }
    if (session.user.role === 'SUPER_ADMIN' && !slug) {
      router.replace('/admin');
      return;
    }
    if (slug) {
      router.replace(`/${slug}/dashboard`);
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return <ShellSkeleton />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}

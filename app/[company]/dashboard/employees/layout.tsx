import { auth } from '@/auth';
import { redirect } from 'next/navigation';

/**
 * People / HR admin surfaces — ADMIN and SUPER_ADMIN only.
 * Nav already hides these for other roles; this enforces deep links.
 */
export default async function HrAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ company: string }>;
}) {
  const session = await auth();
  const role = String(session?.user?.role || '');
  if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
    // Stay in the workspace being browsed, not the user's home workspace
    const { company } = await params;
    redirect(session?.user ? `/${company}/dashboard` : '/auth/signin');
  }
  return children;
}

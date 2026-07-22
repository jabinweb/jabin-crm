import { auth } from '@/auth';
import { redirect } from 'next/navigation';

/**
 * People / HR admin surfaces — ADMIN and SUPER_ADMIN only.
 * Nav already hides these for other roles; this enforces deep links.
 */
export default async function HrAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = String(session?.user?.role || '');
  if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
    const slug =
      (session?.user as { companySlug?: string } | undefined)?.companySlug ||
      '';
    redirect(slug ? `/${slug}/dashboard` : '/auth/signin');
  }
  return children;
}

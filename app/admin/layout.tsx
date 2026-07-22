import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { resolvePostLoginPath } from '@/lib/auth/post-login-path';
import { PlatformAdminShell } from '@/components/admin/platform-admin-shell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'admin';

  if (!session?.user || !isSuperAdmin) {
    redirect(
      resolvePostLoginPath({
        role: session?.user?.role,
        companySlug: (session?.user as { companySlug?: string } | undefined)?.companySlug,
      })
    );
  }

  const exitHref = resolvePostLoginPath({
    role: session.user.role,
    companySlug: (session.user as { companySlug?: string }).companySlug,
  });

  return (
    <PlatformAdminShell
      email={session.user.email}
      name={session.user.name}
      exitHref={exitHref === '/admin' ? '/' : exitHref}
    >
      {children}
    </PlatformAdminShell>
  );
}

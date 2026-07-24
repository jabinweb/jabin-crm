import { redirect } from 'next/navigation';
import { auth } from '@/auth';

type Props = { params: Promise<{ company: string }> };

/**
 * Platform company management lives at `/admin/companies` (SUPER_ADMIN).
 * Workspace admins should not hit the platform companies API from here.
 */
export default async function CompanyScopedCompaniesPage({ params }: Props) {
  const { company } = await params;
  const session = await auth();
  const role = session?.user?.role;

  if (role === 'SUPER_ADMIN') {
    redirect('/admin/companies');
  }

  redirect(`/${company}/admin`);
}

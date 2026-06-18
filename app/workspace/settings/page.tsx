import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getUserPrimaryCompanyId } from '@/lib/auth/company-membership';
import UserProfileSettings from '@/components/settings/user-profile/user-profile-settings';

export default async function WorkspaceSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const companyId = await getUserPrimaryCompanyId(session.user.id);
  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { slug: true, status: true },
    });
    if (company?.slug && company.status === 'APPROVED') {
      redirect(`/${company.slug}/dashboard/settings`);
    }
  }

  return <UserProfileSettings />;
}

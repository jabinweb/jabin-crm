import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUserPrimaryCompanyId } from '@/lib/auth/company-membership'
import LegacyUserProfileSettings from '@/components/settings/legacy-user-profile-settings'

/**
 * Canonical company record + JSON settings live under `/[slug]/dashboard/settings`.
 * Users with an approved primary company are sent there so "company" edits match the tenant model.
 * Personal CRM profile (AI keys, SMTP, etc.) stays on this page when there is no approved workspace yet.
 */
export default async function DashboardSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const companyId = await getUserPrimaryCompanyId(session.user.id)
  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { slug: true, status: true },
    })
    if (company?.slug && company.status === 'APPROVED') {
      redirect(`/${company.slug}/dashboard/settings`)
    }
  }

  return <LegacyUserProfileSettings />
}

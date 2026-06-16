import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isCompanyLayoutAllowed, assertSessionCompanyAccess } from '@/lib/auth/company-membership';
import { notFound } from 'next/navigation';

/**
 * /{company} root — redirects to the canonical /{company}/dashboard.
 * This prevents users landing on a dead-end info page and ensures
 * the authoritative URL is always the dashboard.
 */
export default async function CompanyRootPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company: slug } = await params;

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true },
  });

  const session = await auth();
  if (!company || !(await isCompanyLayoutAllowed(company, session))) {
    notFound();
  }

  if (session?.user?.id) {
    await assertSessionCompanyAccess(session, company, 'dashboard');
  }

  redirect(`/${slug}/dashboard`);
}

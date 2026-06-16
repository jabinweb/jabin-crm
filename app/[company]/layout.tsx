import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isCompanyLayoutAllowed } from '@/lib/auth/company-membership';
import { CompanyProvider, type CompanyData } from '@/contexts/company-context';

interface CompanyLayoutProps {
  children: React.ReactNode;
  params: Promise<{ company: string }>;
}

/**
 * Dynamic layout for all company-scoped pages.
 *
 * URL pattern: /:company/*
 *
 * 1. Resolves the slug to a Company record for normal workspace pages.
 * 2. Returns 404 if the company doesn't exist or isn't approved (except public signup routes).
 * 3. `/[slug]/register` and `/[slug]/employee/register` run without an approved company
 *    (slug is the intended workspace name; company is created after approval).
 * 4. Wraps children with <CompanyProvider> when an approved company exists.
 */
export default async function CompanyLayout({
  children,
  params,
}: CompanyLayoutProps) {
  const { company: companySlug } = await params;
  const pathname = (await headers()).get('x-pathname') || '';
  const isPublicSignupRoute =
    /^\/[^/]+\/register\/?$/.test(pathname) ||
    /^\/[^/]+\/employee\/register\/?$/.test(pathname);

  if (isPublicSignupRoute) {
    return <>{children}</>;
  }

  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      email: true,
      phone: true,
      website: true,
      status: true,
      settings: true,
    },
  });

  const session = await auth();
  if (!company || !(await isCompanyLayoutAllowed(company, session))) {
    notFound();
  }

  // Serialize for the client-side context provider
  const companyData: CompanyData = {
    id: company.id,
    name: company.name,
    slug: company.slug,
    logo: company.logo,
    email: company.email,
    phone: company.phone,
    website: company.website,
    status: company.status,
    settings: company.settings as Record<string, unknown> | null,
  };

  return <CompanyProvider company={companyData}>{children}</CompanyProvider>;
}

/**
 * Generate static params for known companies (optional — improves perf at build time).
 * Remove this if you have too many companies or prefer fully dynamic rendering.
 */
// export async function generateStaticParams() {
//   const companies = await prisma.company.findMany({
//     where: { status: 'APPROVED' },
//     select: { slug: true },
//   });
//   return companies.map((c) => ({ companySlug: c.slug }));
// }

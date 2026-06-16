import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import {
  assertSessionCompanyAccess,
  isCompanyLayoutAllowed,
} from '@/lib/auth/company-membership'
import { EmployeeLayoutClient } from './employee-layout-client'

export default async function EmployeeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ company: string }>
}) {
  const { company: slug } = await params
  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true },
  })
  const path = (await headers()).get('x-pathname') || ''
  const skipTenantAssert =
    path.includes('/employee/login') || path.includes('/employee/register')

  if (!company) {
    notFound()
  }

  if (skipTenantAssert) {
    if (company.status === 'REJECTED') {
      notFound()
    }
    return <EmployeeLayoutClient>{children}</EmployeeLayoutClient>
  }

  const session = await auth()
  if (!(await isCompanyLayoutAllowed(company, session))) {
    notFound()
  }
  await assertSessionCompanyAccess(session, company, 'employee/dashboard')

  return <EmployeeLayoutClient>{children}</EmployeeLayoutClient>
}

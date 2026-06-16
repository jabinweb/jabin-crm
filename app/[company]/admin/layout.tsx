import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import {
  assertSessionCompanyAccess,
  isCompanyLayoutAllowed,
} from '@/lib/auth/company-membership'
import { AdminLayoutClient } from './admin-layout-client'

export default async function AdminLayout({
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
  const session = await auth()
  if (!company || !(await isCompanyLayoutAllowed(company, session))) {
    notFound()
  }
  await assertSessionCompanyAccess(session, company, 'admin')

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}

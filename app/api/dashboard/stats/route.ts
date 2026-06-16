import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createApiHandler } from '@/lib/api-utils'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'
import "@/types/auth"

export const GET = createApiHandler(async (req: NextRequest, _user: unknown) => {
  const session = await auth()
  if (!session?.user) {
    throw new TenantError(401, 'Unauthorized')
  }
  const { companyId } = await resolveCompanyContextFromRequest(session, req)

  try {
    const [employeesCount, clientsCount, productsCount, projectsCount] =
      await Promise.all([
        prisma.employee.count({
          where: { companyId },
        }),
        prisma.client.count({
          where: { companyId },
        }),
        prisma.product.count({
          where: { companyId },
        }),
        prisma.project.count({
          where: { companyId },
        }),
      ])

    return new Response(
      JSON.stringify({
        employees: employeesCount,
        clients: clientsCount,
        products: productsCount,
        projects: projectsCount,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[Dashboard Stats] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

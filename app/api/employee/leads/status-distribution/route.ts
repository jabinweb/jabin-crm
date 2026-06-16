import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LeadStatus } from '@prisma/client'
import { handleApiError } from '@/lib/api-error-handler'
import { isApiException } from '@/lib/api/subscription-guards'
import { requireEmployeeModule } from '@/lib/api/employee-guard'

type LeadStatusCountRow = { status: LeadStatus; _count: number }

export async function GET(req: NextRequest) {
  try {
    const session = await requireEmployeeModule('LEADS')

    const leads = (await prisma.lead.groupBy({
      by: ['status'],
      where: {
        employeeId: session.user.employeeId
      },
      _count: true
    })) as LeadStatusCountRow[]

    const distribution = leads.reduce<Record<LeadStatus, number>>(
      (acc, { status, _count }: LeadStatusCountRow) => {
        acc[status] = _count
        return acc
      },
      Object.values(LeadStatus).reduce((acc, status) => {
        acc[status] = 0
        return acc
      }, {} as Record<LeadStatus, number>)
    )

    return new Response(JSON.stringify(distribution), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    if (isApiException(error)) return handleApiError(error)
    console.error('[API] Lead status distribution error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

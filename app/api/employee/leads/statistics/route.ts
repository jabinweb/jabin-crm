import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ActivityType, LeadStatus } from '@prisma/client'
import { handleApiError } from '@/lib/api-error-handler'
import { isApiException } from '@/lib/api/subscription-guards'
import { requireEmployeeModule } from '@/lib/api/employee-guard'

export async function GET(req: NextRequest) {
  try {
    const session = await requireEmployeeModule('LEADS')

    const [
      totalLeads,
      wonLeads,
      activeLeads,
      upcomingFollowUps
    ] = await Promise.all([
      // Total leads count
      prisma.lead.count({
        where: { employeeId: session.user.employeeId }
      }),
      // Won leads count
      prisma.lead.count({
        where: {
          employeeId: session.user.employeeId,
          status: LeadStatus.WON
        }
      }),
      // Active leads (not WON or LOST)
      prisma.lead.count({
        where: {
          employeeId: session.user.employeeId,
          NOT: {
            status: { in: [LeadStatus.WON, LeadStatus.LOST] }
          }
        }
      }),
      // Upcoming follow-ups
      prisma.lead.findMany({
        where: {
          employeeId: session.user.employeeId,
          activities: {
            some: {
              activityType: ActivityType.FOLLOW_UP,
              completed: false,
              dueDate: { gte: new Date() },
            },
          },
        },
        select: {
          id: true,
          companyName: true,
          name: true,
          lastContactedAt: true,
          status: true,
        },
        orderBy: {
          lastContactedAt: 'asc',
        },
        take: 5,
      })
    ])

    return new Response(JSON.stringify({
      totalLeads,
      wonLeads,
      activeLeads,
      upcomingFollowUps,
      conversionRate: totalLeads ? (wonLeads / totalLeads) * 100 : 0
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    if (isApiException(error)) return handleApiError(error)
    console.error('[API] Lead statistics error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

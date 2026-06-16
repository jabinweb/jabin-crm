import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LeadStatus, ActivityType } from '@prisma/client'
import { handleApiError } from '@/lib/api-error-handler'
import { isApiException } from '@/lib/api/subscription-guards'
import { requireEmployeeModule } from '@/lib/api/employee-guard'

export async function GET(req: NextRequest) {
  try {
    const session = await requireEmployeeModule('LEADS')

    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const leads = await prisma.lead.findMany({
      where: {
        employeeId: session.user.employeeId,
        OR: [
          {
            activities: {
              some: {
                activityType: ActivityType.FOLLOW_UP,
                completed: false,
                dueDate: { lte: in24h },
              },
            },
          },
          {
            lastContactedAt: {
              lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Not contacted in 7 days
            },
            NOT: {
              status: {
                in: [LeadStatus.WON, LeadStatus.LOST]
              }
            }
          }
        ]
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true
          }
        },
        activities: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            activities: true,
            documents: true
          }
        }
      },
      orderBy: [
        { lastContactedAt: 'asc' }
      ]
    })

    return new Response(JSON.stringify({ leads }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    if (isApiException(error)) return handleApiError(error)
    console.error('[API] Follow-up leads error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

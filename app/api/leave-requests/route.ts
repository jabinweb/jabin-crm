import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { LeaveStatus } from '@prisma/client'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

/** Admin: list leave requests for the current company workspace. */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as { role?: string }).role
    if (!role || !['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req)
    const status = req.nextUrl.searchParams.get('status') as LeaveStatus | null

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employee: { companyId },
        ...(status && Object.values(LeaveStatus).includes(status) ? { status } : {}),
      },
      include: {
        employee: { select: { id: true, name: true, email: true, department: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(leaveRequests)
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Leave requests list error:', error)
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 })
  }
}

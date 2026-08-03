import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'
import { processLeaveAction } from '@/lib/hr/leave-actions'
import { hasLegacyRole } from '@/lib/auth/permissions'

interface RouteParams {
  params: Promise<{
    id: string
    action: string
  }>
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const paramsData = await params
    const { id, action } = paramsData
    const body = await request.json().catch(() => ({}))
    const comment = body?.comment

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
    }

    // Tenant check happens inside process via existingRequest; verify company for non-super
    if (!hasLegacyRole(session, 'SUPER_ADMIN')) {
      const { companyId } = await resolveCompanyContextFromRequest(session, request)
      const { prisma } = await import('@/lib/prisma')
      const existing = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { employee: { select: { companyId: true } } },
      })
      if (!existing || existing.employee.companyId !== companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { updatedRequest } = await processLeaveAction({
      leaveRequestId: id,
      action,
      comment,
      actorEmployeeId: session.user.employeeId ?? null,
    })

    return NextResponse.json({
      success: true,
      message: `Leave request ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: updatedRequest,
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const status = (error as { status?: number })?.status || 500
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Leave request action error:', { message: errorMessage })

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process leave request',
        error: errorMessage,
      },
      { status }
    )
  }
}

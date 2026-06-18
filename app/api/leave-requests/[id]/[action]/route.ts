import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { handleRouteError } from '@/lib/api/tenant-response';
import { prisma } from '@/lib/prisma'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

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

    const role = (session.user as { role?: string }).role
    if (!role || !['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const paramsData = await params
    const { id, action } = paramsData
    const { comment } = await request.json()

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
    }

    const existingRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            name: true,
            companyId: true,
          },
        },
      },
    })

    if (!existingRequest) {
      return NextResponse.json({ message: 'Leave request not found' }, { status: 404 })
    }

    if (existingRequest.status !== 'PENDING') {
      return NextResponse.json(
        { message: 'Leave request not found or already processed' },
        { status: 400 }
      )
    }

    if (role !== 'SUPER_ADMIN') {
      const { companyId } = await resolveCompanyContextFromRequest(session, request)
      if (existingRequest.employee.companyId !== companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        comment,
        actionById: session.user.employeeId ?? null,
        actionAt: new Date(),
        updatedAt: new Date(),
      },
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Leave request action error:', { message: errorMessage })

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process leave request',
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { processLeaveAction } from '@/lib/hr/leave-actions'

async function managerGate() {
  const session = await auth()
  if (!session?.user?.employeeId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const me = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    select: {
      id: true,
      role: true,
      companyId: true,
      _count: { select: { subordinates: true } },
    },
  })
  if (!me) {
    return { error: NextResponse.json({ error: 'Employee not found' }, { status: 404 }) }
  }
  const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')
  const isManager = me.role === 'MANAGER' || me._count.subordinates > 0 || isAdmin
  if (!isManager) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session, me, isAdmin }
}

export async function GET() {
  try {
    const ctx = await managerGate()
    if ('error' in ctx && ctx.error) return ctx.error
    const { me, isAdmin } = ctx as {
      me: { id: string; companyId: string }
      isAdmin: boolean
    }

    const reportIds = isAdmin
      ? (
          await prisma.employee.findMany({
            where: { companyId: me.companyId },
            select: { id: true },
          })
        ).map((e) => e.id)
      : (
          await prisma.employee.findMany({
            where: { managerId: me.id },
            select: { id: true },
          })
        ).map((e) => e.id)

    const requests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: reportIds },
        status: 'PENDING',
      },
      include: {
        employee: {
          select: { id: true, name: true, employeeId: true, department: true },
        },
        policy: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(requests)
  } catch (error) {
    console.error('[manager/leave GET]', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await managerGate()
    if ('error' in ctx && ctx.error) return ctx.error
    const { session, me, isAdmin } = ctx as {
      session: { user: { employeeId?: string | null } }
      me: { id: string }
      isAdmin: boolean
    }

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : null
    if (!id || !action) {
      return NextResponse.json({ error: 'id and action required' }, { status: 400 })
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: { select: { managerId: true } } },
    })
    if (!leave) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!isAdmin && leave.employee.managerId !== me.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { updatedRequest } = await processLeaveAction({
      leaveRequestId: id,
      action,
      comment: typeof body.comment === 'string' ? body.comment : null,
      actorEmployeeId: session.user.employeeId ?? me.id,
    })

    return NextResponse.json({ success: true, data: updatedRequest })
  } catch (error) {
    const status = (error as { status?: number })?.status || 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership'
import { asNextRequest } from '@/lib/api/as-next-request'
import { logEmployeeActivity } from '@/lib/hr/activity'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { companyId: true },
    })
    if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')
    const isSelf = session.user.employeeId === id
    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (isAdmin) {
      const { companyId } = await resolveCompanyContextFromRequest(
        session,
        asNextRequest(request)
      )
      if (employee.companyId !== companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const rows = await prisma.employeeActivity.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { id: true, name: true } } },
    })
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

/** Manual work-history / note entry (admin, or self for a personal note). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { companyId: true },
    })
    if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')
    const isSelf = session.user.employeeId === id
    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (isAdmin) {
      const { companyId } = await resolveCompanyContextFromRequest(
        session,
        asNextRequest(request)
      )
      if (employee.companyId !== companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await request.json()
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return NextResponse.json({ error: 'message required' }, { status: 400 })
    }

    await logEmployeeActivity({
      employeeId: id,
      actorId: session.user.employeeId ?? null,
      type: typeof body.type === 'string' && body.type ? body.type : 'NOTE',
      message,
      meta: body.meta && typeof body.meta === 'object' ? body.meta : undefined,
    })

    const rows = await prisma.employeeActivity.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { id: true, name: true } } },
    })
    return NextResponse.json(rows, { status: 201 })
  } catch (error) {
    console.error('[employee activities POST]', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

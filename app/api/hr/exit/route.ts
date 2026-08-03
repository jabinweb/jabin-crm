import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership'
import { asNextRequest } from '@/lib/api/as-next-request'
import { logEmployeeActivity } from '@/lib/hr/activity'

const DEFAULT_CLEARANCE = [
  { item: 'IT assets returned', done: false },
  { item: 'Access revoked', done: false },
  { item: 'Finance clearance', done: false },
  { item: 'Exit interview', done: false },
  { item: 'Experience letter', done: false },
]

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')

    if (isAdmin) {
      const { companyId } = await resolveCompanyContextFromRequest(
        session,
        asNextRequest(request)
      )
      const rows = await prisma.exitRequest.findMany({
        where: { employee: { companyId } },
        include: { employee: { select: { id: true, name: true, employeeId: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(rows)
    }

    if (!session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const rows = await prisma.exitRequest.findMany({
      where: { employeeId: session.user.employeeId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const lastWorkingDay = body.lastWorkingDay ? new Date(body.lastWorkingDay) : null
    if (!reason || !lastWorkingDay || Number.isNaN(lastWorkingDay.getTime())) {
      return NextResponse.json(
        { error: 'reason and lastWorkingDay required' },
        { status: 400 }
      )
    }
    const row = await prisma.exitRequest.create({
      data: {
        employeeId: session.user.employeeId,
        reason,
        lastWorkingDay,
        clearance: DEFAULT_CLEARANCE,
        status: 'PENDING',
      },
    })
    await logEmployeeActivity({
      employeeId: session.user.employeeId,
      actorId: session.user.employeeId,
      type: 'EXIT_REQUESTED',
      message: 'Resignation / exit request submitted',
    })
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user || !hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { companyId } = await resolveCompanyContextFromRequest(
      session,
      asNextRequest(request)
    )
    const body = await request.json()
    const id = body.id as string
    const existing = await prisma.exitRequest.findFirst({
      where: { id, employee: { companyId } },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (body.action === 'toggle_clearance') {
      const index = Number(body.index)
      const clearance = Array.isArray(existing.clearance)
        ? ([...(existing.clearance as object[])] as {
            item: string
            done: boolean
          }[])
        : []
      if (!clearance[index]) {
        return NextResponse.json({ error: 'Invalid item' }, { status: 400 })
      }
      clearance[index] = { ...clearance[index], done: !clearance[index].done }
      const allDone = clearance.every((c) => c.done)
      const updated = await prisma.exitRequest.update({
        where: { id },
        data: {
          clearance,
          status: allDone ? 'CLEARED' : existing.status === 'PENDING' ? 'IN_PROGRESS' : existing.status,
        },
      })
      return NextResponse.json(updated)
    }

    if (body.action === 'complete') {
      const updated = await prisma.exitRequest.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          actionById: session.user.employeeId ?? null,
          actionAt: new Date(),
          ...(typeof body.interviewNotes === 'string'
            ? { interviewNotes: body.interviewNotes }
            : {}),
        },
      })
      await prisma.employee.update({
        where: { id: existing.employeeId },
        data: { status: 'TERMINATED' },
      })
      await logEmployeeActivity({
        employeeId: existing.employeeId,
        actorId: session.user.employeeId,
        type: 'EXIT_COMPLETED',
        message: 'Exit process completed',
      })
      return NextResponse.json(updated)
    }

    if (body.action === 'save_notes') {
      const updated = await prisma.exitRequest.update({
        where: { id },
        data: {
          interviewNotes:
            typeof body.interviewNotes === 'string' ? body.interviewNotes : null,
        },
      })
      return NextResponse.json(updated)
    }

    if (body.status) {
      const updated = await prisma.exitRequest.update({
        where: { id },
        data: { status: String(body.status) },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[exit]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

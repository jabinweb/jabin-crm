import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership'
import { asNextRequest } from '@/lib/api/as-next-request'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || undefined

    if (isAdmin) {
      const { companyId } = await resolveCompanyContextFromRequest(
        session,
        asNextRequest(request)
      )
      const rows = await prisma.attendanceCorrection.findMany({
        where: {
          ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
          employee: { companyId },
        },
        include: {
          employee: { select: { id: true, name: true, employeeId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      return NextResponse.json(rows)
    }

    if (!session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const rows = await prisma.attendanceCorrection.findMany({
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
    const date = body.date ? new Date(body.date) : null
    if (!reason || !date || Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'date and reason required' }, { status: 400 })
    }
    const row = await prisma.attendanceCorrection.create({
      data: {
        employeeId: session.user.employeeId,
        date,
        reason,
        requestedCheckIn: body.requestedCheckIn
          ? new Date(body.requestedCheckIn)
          : null,
        requestedCheckOut: body.requestedCheckOut
          ? new Date(body.requestedCheckOut)
          : null,
        attendanceId: body.attendanceId || null,
      },
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
    const action = body.action as 'approve' | 'reject'
    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'id and action required' }, { status: 400 })
    }

    const existing = await prisma.attendanceCorrection.findFirst({
      where: { id, employee: { companyId }, status: 'PENDING' },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'approve') {
      const dayStart = new Date(existing.date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      let attendance = existing.attendanceId
        ? await prisma.attendance.findUnique({ where: { id: existing.attendanceId } })
        : await prisma.attendance.findFirst({
            where: {
              employeeId: existing.employeeId,
              createdAt: { gte: dayStart, lt: dayEnd },
            },
          })

      if (attendance) {
        await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            checkIn: existing.requestedCheckIn || attendance.checkIn,
            checkOut: existing.requestedCheckOut || attendance.checkOut,
            status: 'PRESENT',
          },
        })
      } else if (existing.requestedCheckIn) {
        await prisma.attendance.create({
          data: {
            employeeId: existing.employeeId,
            checkIn: existing.requestedCheckIn,
            checkOut: existing.requestedCheckOut,
            status: 'PRESENT',
            createdAt: dayStart,
          },
        })
      }
    }

    const updated = await prisma.attendanceCorrection.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        actionById: session.user.employeeId ?? null,
        actionAt: new Date(),
        comment: body.comment || null,
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[attendance-corrections PATCH]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

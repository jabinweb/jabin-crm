import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership'
import { asNextRequest } from '@/lib/api/as-next-request'
import { attendanceDateOnly } from '@/lib/hr/leave-year'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = new URL(request.url)
    // Company-wide list only for the HR admin page (?admin=1); an admin's own
    // self-service page lists just their corrections like everyone else's.
    const isAdmin =
      hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN') && url.searchParams.get('admin') === '1'
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
    const attendanceId =
      typeof body.attendanceId === 'string' && body.attendanceId ? body.attendanceId : null
    if (attendanceId) {
      const own = await prisma.attendance.findFirst({
        where: { id: attendanceId, employeeId: session.user.employeeId },
        select: { id: true },
      })
      if (!own) {
        return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
      }
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
        attendanceId,
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
    if (session.user.employeeId && existing.employeeId === session.user.employeeId) {
      return NextResponse.json({ error: 'You cannot act on your own correction' }, { status: 403 })
    }

    if (action === 'approve') {
      const day = attendanceDateOnly(new Date(existing.date))

      // Look up by the unique (employeeId, date) key so approval never collides with an
      // existing row, and never touches another employee's attendance.
      const attendance = existing.attendanceId
        ? await prisma.attendance.findFirst({
            where: { id: existing.attendanceId, employeeId: existing.employeeId },
          })
        : await prisma.attendance.findUnique({
            where: {
              employeeId_date: { employeeId: existing.employeeId, date: day },
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
            date: day,
            checkIn: existing.requestedCheckIn,
            checkOut: existing.requestedCheckOut,
            status: 'PRESENT',
            createdAt: day,
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

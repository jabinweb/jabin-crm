import { NextResponse } from 'next/server'
import { requireManager, isManagerError } from '@/lib/hr/manager-gate'
import { prisma } from '@/lib/prisma'
import {
  evaluateCheckInStatus,
  evaluateCheckOut,
  getActiveShiftForEmployee,
  minutesSinceMidnight,
} from '@/lib/hr/shift-attendance'
import { attendanceDateOnly } from '@/lib/hr/leave-year'

// Same manager rule and team scope as /api/manager/team and /api/manager/leave.
export async function GET() {
  try {
    const ctx = await requireManager()
    if (isManagerError(ctx)) return ctx.error
    const rows = await prisma.attendanceCorrection.findMany({
      where: {
        status: 'PENDING',
        employee: ctx.teamWhere,
      },
      include: {
        employee: { select: { id: true, name: true, employeeId: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireManager()
    if (isManagerError(ctx)) return ctx.error
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const approve = body.status !== 'REJECTED'
    const row = await prisma.attendanceCorrection.findFirst({
      where: {
        id,
        employee: ctx.teamWhere,
      },
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (row.status !== 'PENDING') {
      return NextResponse.json({ error: 'Correction already processed' }, { status: 400 })
    }

    const updated = await prisma.attendanceCorrection.update({
      where: { id },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        actionById: ctx.me.id,
        actionAt: new Date(),
        comment: body.comment || null,
      },
    })

    if (approve && row.requestedCheckIn) {
      const date = attendanceDateOnly(new Date(row.date))
      const shift = await getActiveShiftForEmployee(row.employeeId, row.requestedCheckIn)
      const status = evaluateCheckInStatus(row.requestedCheckIn, shift)
      let lateMinutes = 0
      if (shift && status === 'LATE') {
        const [h, m] = shift.startTime.split(':').map((x) => parseInt(x, 10))
        lateMinutes = Math.max(
          0,
          minutesSinceMidnight(row.requestedCheckIn) -
            ((h || 0) * 60 + (m || 0)) -
            shift.graceMinutes
        )
      }
      let overtime = 0
      let earlyDeparture = false
      if (row.requestedCheckOut) {
        const ev = evaluateCheckOut(row.requestedCheckIn, row.requestedCheckOut, shift)
        overtime = ev.overtimeMinutes
        earlyDeparture = ev.earlyDeparture
      }
      await prisma.attendance.upsert({
        where: {
          employeeId_date: { employeeId: row.employeeId, date },
        },
        create: {
          employeeId: row.employeeId,
          date,
          status,
          checkIn: row.requestedCheckIn,
          checkOut: row.requestedCheckOut,
          lateMinutes,
          overtime,
          earlyDeparture,
        },
        update: {
          status,
          checkIn: row.requestedCheckIn,
          checkOut: row.requestedCheckOut,
          lateMinutes,
          overtime,
          earlyDeparture,
        },
      })
    }

    return NextResponse.json(updated)
  } catch (e) {
    console.error('[manager corrections]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

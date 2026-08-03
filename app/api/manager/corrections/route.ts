import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { evaluateCheckInStatus, evaluateCheckOut, getActiveShiftForEmployee } from '@/lib/hr/shift-attendance'
import { attendanceDateOnly } from '@/lib/hr/leave-year'

async function requireManager(sessionEmployeeId: string) {
  const reports = await prisma.employee.count({
    where: { managerId: sessionEmployeeId },
  })
  return reports > 0
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await requireManager(session.user.employeeId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const rows = await prisma.attendanceCorrection.findMany({
      where: {
        status: 'PENDING',
        employee: { managerId: session.user.employeeId },
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
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const id = body.id as string
    const approve = body.status !== 'REJECTED'
    const row = await prisma.attendanceCorrection.findFirst({
      where: {
        id,
        employee: { managerId: session.user.employeeId },
      },
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.attendanceCorrection.update({
      where: { id },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        actionById: session.user.employeeId,
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
          row.requestedCheckIn.getHours() * 60 +
            row.requestedCheckIn.getMinutes() -
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

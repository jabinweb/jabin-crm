import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isHrAdminResult, requireHrAdmin } from '@/lib/hr/api-auth'
import { attendanceDateOnly } from '@/lib/hr/leave-year'

function weekStart(d = new Date()) {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return attendanceDateOnly(x)
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const asAdmin = url.searchParams.get('admin') === '1'

    if (asAdmin) {
      const ctx = await requireHrAdmin(request)
      if (isHrAdminResult(ctx)) return ctx.error
      const rows = await prisma.timesheet.findMany({
        where: { employee: { companyId: ctx.companyId } },
        include: {
          employee: { select: { name: true, employeeId: true } },
          entries: true,
        },
        orderBy: { weekStart: 'desc' },
        take: 100,
      })
      return NextResponse.json(rows)
    }

    if (!session.user.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const rows = await prisma.timesheet.findMany({
      where: { employeeId: session.user.employeeId },
      include: { entries: true },
      orderBy: { weekStart: 'desc' },
      take: 20,
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
    const start = body.weekStart ? attendanceDateOnly(new Date(body.weekStart)) : weekStart()

    if (body.action === 'upsert') {
      const entries = Array.isArray(body.entries) ? body.entries : []
      const sheet = await prisma.timesheet.upsert({
        where: {
          employeeId_weekStart: {
            employeeId: session.user.employeeId,
            weekStart: start,
          },
        },
        create: {
          employeeId: session.user.employeeId,
          weekStart: start,
          status: 'DRAFT',
        },
        update: {},
      })
      await prisma.timesheetEntry.deleteMany({ where: { timesheetId: sheet.id } })
      if (entries.length) {
        await prisma.timesheetEntry.createMany({
          data: entries.map(
            (e: { date: string; hours: number; note?: string; projectId?: string }) => ({
              timesheetId: sheet.id,
              date: attendanceDateOnly(new Date(e.date)),
              hours: Number(e.hours) || 0,
              note: e.note || null,
              projectId: e.projectId || null,
            })
          ),
        })
      }
      const full = await prisma.timesheet.findUnique({
        where: { id: sheet.id },
        include: { entries: true },
      })
      return NextResponse.json(full)
    }

    if (body.action === 'submit') {
      const id = body.id as string
      const sheet = await prisma.timesheet.findFirst({
        where: { id, employeeId: session.user.employeeId },
      })
      if (!sheet) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const updated = await prisma.timesheet.update({
        where: { id },
        data: { status: 'SUBMITTED' },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[timesheets]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireHrAdmin(request)
    if (isHrAdminResult(ctx)) return ctx.error
    const body = await request.json()
    const id = body.id as string
    const sheet = await prisma.timesheet.findFirst({
      where: { id, employee: { companyId: ctx.companyId } },
    })
    if (!sheet) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const status = body.status === 'REJECTED' ? 'REJECTED' : 'APPROVED'
    const updated = await prisma.timesheet.update({
      where: { id },
      data: {
        status,
        actionById: ctx.session.user.employeeId || null,
        actionAt: new Date(),
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

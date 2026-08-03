import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership'
import { asNextRequest } from '@/lib/api/as-next-request'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let companyId: string | undefined
    try {
      const ctx = await resolveCompanyContextFromRequest(session, request)
      companyId = ctx.companyId
    } catch {
      const empId = session.user.employeeId
      if (empId) {
        const emp = await prisma.employee.findUnique({
          where: { id: empId },
          select: { companyId: true },
        })
        companyId = emp?.companyId
      }
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company context' }, { status: 400 })
    }

    const upcoming = request.nextUrl.searchParams.get('upcoming') === '1'
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const holidays = await prisma.companyHoliday.findMany({
      where: {
        companyId,
        ...(upcoming ? { date: { gte: now } } : {}),
      },
      orderBy: { date: 'asc' },
      take: upcoming ? 10 : 200,
    })

    return NextResponse.json(holidays)
  } catch (error) {
    console.error('[employee/holidays GET]', error)
    return NextResponse.json({ error: 'Failed to load holidays' }, { status: 500 })
  }
}

/** Admin create — also used from dashboard holidays page via same path or /api/holidays */
export async function POST(request: Request) {
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
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const date = body.date ? new Date(body.date) : null
    const type = typeof body.type === 'string' ? body.type : 'PUBLIC'

    if (!name || !date || Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'name and date are required' }, { status: 400 })
    }

    const holiday = await prisma.companyHoliday.create({
      data: { companyId, name, date, type },
    })
    return NextResponse.json(holiday, { status: 201 })
  } catch (error) {
    console.error('[employee/holidays POST]', error)
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/** Lightweight project list for employee timesheet picker. */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      select: { companyId: true },
    })
    if (!employee?.companyId) {
      return NextResponse.json([])
    }

    const projects = await prisma.project.findMany({
      where: {
        companyId: employee.companyId,
        status: { in: ['ACTIVE', 'ON_HOLD'] },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    })

    return NextResponse.json(projects)
  } catch (e) {
    console.error('[employee/projects]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

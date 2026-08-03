import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')
    const isManager = me.role === 'MANAGER' || me._count.subordinates > 0 || isAdmin
    if (!isManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)

    const team = await prisma.employee.findMany({
      where: isAdmin
        ? { companyId: me.companyId, status: { in: ['ACTIVE', 'ON_LEAVE'] } }
        : { managerId: me.id, status: { in: ['ACTIVE', 'ON_LEAVE'] } },
      select: {
        id: true,
        name: true,
        employeeId: true,
        jobTitle: true,
        department: true,
        avatar: true,
        attendance: {
          where: { createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            status: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      take: isAdmin ? 100 : 50,
    })

    return NextResponse.json({
      managerId: me.id,
      isAdmin,
      team: team.map(({ attendance, ...t }) => ({
        ...t,
        today: attendance[0] || null,
      })),
    })
  } catch (error) {
    console.error('[manager/team]', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

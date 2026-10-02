import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hasLegacyRole } from '@/lib/auth/permissions'

export type ManagerContext = {
  session: Session
  me: { id: string; companyId: string }
  isAdmin: boolean
  /** Employees this manager may act for: direct reports, or the whole company for admins (never self). */
  teamWhere: Prisma.EmployeeWhereInput
}

/**
 * One rule for every manager tool (/api/manager/*, /employee/team):
 * an employee is a manager when their Employee.role is MANAGER, they have direct
 * reports, or the user is ADMIN/SUPER_ADMIN (company-wide scope).
 */
export async function requireManager(): Promise<ManagerContext | { error: NextResponse }> {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!session.user.employeeId) {
    return { error: NextResponse.json({ error: 'No employee profile' }, { status: 403 }) }
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
    return { error: NextResponse.json({ error: 'Employee not found' }, { status: 404 }) }
  }
  const isAdmin = hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')
  const isManager = me.role === 'MANAGER' || me._count.subordinates > 0 || isAdmin
  if (!isManager) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  const teamWhere: Prisma.EmployeeWhereInput = isAdmin
    ? { companyId: me.companyId, id: { not: me.id } }
    : { managerId: me.id, companyId: me.companyId }
  return { session, me: { id: me.id, companyId: me.companyId }, isAdmin, teamWhere }
}

export function isManagerError(
  value: ManagerContext | { error: NextResponse }
): value is { error: NextResponse } {
  return 'error' in value
}

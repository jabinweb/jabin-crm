import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  ensureEmployeeLeaveBalances,
  ensureLeavePolicies,
} from '@/lib/hr/leave-service'
import { prisma } from '@/lib/prisma'

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
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    await ensureLeavePolicies(employee.companyId)
    const balances = await ensureEmployeeLeaveBalances(
      session.user.employeeId,
      employee.companyId
    )

    return NextResponse.json(balances)
  } catch (error) {
    console.error('[leave/balances]', error)
    return NextResponse.json({ error: 'Failed to load balances' }, { status: 500 })
  }
}

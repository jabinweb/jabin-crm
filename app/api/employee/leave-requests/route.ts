import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  ensureEmployeeLeaveBalances,
  findPolicyByTypeOrCode,
  leaveDaysBetween,
} from '@/lib/hr/leave-service'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: { employeeId: session.user.employeeId },
      orderBy: { createdAt: 'desc' },
      include: { policy: { select: { id: true, name: true, code: true } } },
    })

    return NextResponse.json(leaveRequests)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 })
  }
}

/** Same balance-aware create as /api/employee/leave (legacy path). */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { startDate, endDate, reason, type, policyId } = body

    if (!startDate || !endDate || !reason || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      select: { companyId: true },
    })
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const policy =
      (policyId
        ? await prisma.leavePolicy.findFirst({
            where: { id: policyId, companyId: employee.companyId, active: true },
          })
        : null) || (await findPolicyByTypeOrCode(employee.companyId, String(type)))

    if (!policy) {
      return NextResponse.json({ error: 'No leave policy found' }, { status: 400 })
    }

    const days = leaveDaysBetween(start, end)
    const year = start.getFullYear()
    await ensureEmployeeLeaveBalances(session.user.employeeId, employee.companyId, year)

    const leaveRequest = await prisma.$transaction(async (tx) => {
      const balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_policyId_year: {
            employeeId: session.user.employeeId!,
            policyId: policy.id,
            year,
          },
        },
      })
      if (!balance) throw new Error('Leave balance missing')

      const remaining = balance.entitled - balance.used - balance.pending
      if (days > remaining) {
        throw new Error(
          `Insufficient balance. Remaining ${remaining} day(s) for ${policy.name}`
        )
      }

      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: { increment: days } },
      })

      return tx.leaveRequest.create({
        data: {
          startDate: start,
          endDate: end,
          type: policy.code,
          reason,
          status: 'PENDING',
          employeeId: session.user.employeeId!,
          policyId: policy.id,
          days,
        },
      })
    })

    return NextResponse.json(leaveRequest, { status: 201 })
  } catch (error) {
    console.error('Error creating leave request:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create leave request',
      },
      { status: 400 }
    )
  }
}

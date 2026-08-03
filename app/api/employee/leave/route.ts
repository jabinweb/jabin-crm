import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  ensureEmployeeLeaveBalances,
  findPolicyByTypeOrCode,
  leaveDaysBetween,
} from '@/lib/hr/leave-service'

const leaveRequestSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  type: z.string(),
  reason: z.string().min(1),
  policyId: z.string().optional(),
})

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
  } catch (error) {
    console.error('Leave request fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = leaveRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error },
        { status: 400 }
      )
    }

    const { startDate, endDate, type, reason, policyId } = validation.data
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
        : null) || (await findPolicyByTypeOrCode(employee.companyId, type))

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
    console.error('Leave request error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create leave request',
      },
      { status: 400 }
    )
  }
}

/** Employees may only cancel their own PENDING requests. */
export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const action = String(body.action || body.status || '').toUpperCase()

    if (!id || action !== 'CANCEL') {
      return NextResponse.json(
        { error: 'Employees can only cancel pending leave (action=CANCEL)' },
        { status: 403 }
      )
    }

    const existing = await prisma.leaveRequest.findFirst({
      where: { id, employeeId: session.user.employeeId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending leave can be cancelled' }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (existing.policyId) {
        const year = existing.startDate.getFullYear()
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_policyId_year: {
              employeeId: existing.employeeId,
              policyId: existing.policyId,
              year,
            },
          },
        })
        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pending: Math.max(0, balance.pending - existing.days),
            },
          })
        }
      }
      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          comment: body.comment || 'Cancelled by employee',
          actionById: session.user.employeeId,
          actionAt: new Date(),
        },
      })
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Leave request update error:', error)
    return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 })
  }
}
